import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approval.repository";
import { parseListQuery, searchCondition, pagination } from "../proposed-changes.service";
import { sendApprovalEmails } from "./approval.mail";

/** GET /ongoing — daftar PC yang menunggu approval (approval_auth_id dipaksa = diri sendiri oleh route). */
export async function listOngoing(query: any) {
  const { page, limit, searchTerm, orderBy, offset } = parseListQuery(query);

  const whereCondition: any = { is_deleted: false };
  const andConditions = [];
  if (searchTerm) andConditions.push(searchCondition(searchTerm));
  if (query.status) andConditions.push({ status: query.status as string });
  if (query.change_type) andConditions.push({ change_type: query.change_type as string });
  if (query.plant_id) andConditions.push({ plant_id: Number(query.plant_id) });
  if (query.department_id) andConditions.push({ department_id: Number(query.department_id) });
  if (query.section_department_id) andConditions.push({ section_department_id: Number(query.section_department_id) });
  if (query.line_code) andConditions.push({ line_code: query.line_code as string });
  if (query.need_engineering_approval !== undefined) {
    andConditions.push({ need_engineering_approval: query.need_engineering_approval === "true" });
  }
  if (query.need_production_approval !== undefined) {
    andConditions.push({ need_production_approval: query.need_production_approval === "true" });
  }
  if (query.progress) andConditions.push({ progress: query.progress as string });
  if (query.created_by) andConditions.push({ created_by: query.created_by as string });

  // approval milik auth_id ini yang on_going atau not_approved
  if (query.approval_auth_id) {
    andConditions.push({
      approvals: {
        some: {
          auth_id: Number(query.approval_auth_id),
          status: { in: ["on_going", "not_approved"] },
        },
      },
    });
  }
  if (query.id) andConditions.push({ id: Number(query.id) });
  if (query.approval_status) {
    andConditions.push({ approvals: { some: { status: query.approval_status as string } } });
  }
  if (query.employee_code) {
    andConditions.push({ approvals: { some: { employee_code: query.employee_code as string } } });
  }
  if (andConditions.length > 0) whereCondition.AND = andConditions;

  const [data, totalCount] = await repo.findOngoingPage(whereCondition, offset, limit, orderBy);
  return { data, pagination: pagination(totalCount, page, limit) };
}

const validStatuses = ["approved", "not_approved", "rejected"];

/** POST /status — approver menyetujui / tidak menyetujui / menolak. auth_id & employee_code dari token. */
export async function updateStatus(body: any) {
  const { proposed_changes_id, auth_id, status, note, employee_code } = body;

  // pesan khusus { error, message }, jadi tetap di service
  if (!proposed_changes_id || !auth_id || !status) {
    throw new HttpError(400, {
      error: "Bad Request",
      message: "Required parameters missing: proposed_changes_id, auth_id, and status are required",
    });
  }
  if (!validStatuses.includes(status)) {
    throw new HttpError(400, {
      error: "Bad Request",
      message: `Invalid status. Status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const currentApproval = await repo.findApproval(Number(proposed_changes_id), Number(auth_id));
  if (!currentApproval) {
    throw new HttpError(404, {
      error: "Not Found",
      message: "No approval found with the provided proposed_changes_id and auth_id",
    });
  }

  // status 'approved' tidak boleh diubah lagi
  if (currentApproval.status === "approved") {
    throw new HttpError(400, {
      error: "Bad Request",
      message: "Cannot change status from 'approved' to another status",
    });
  }

  const currentTimestamp = new Date();
  const oneMinuteAgo = new Date(currentTimestamp.getTime() - 60000);

  // allApprovals dibaca bersamaan dengan cek duplikat; hanya dipakai kalau bukan duplikat
  const [existingIdenticalHistory, allApprovals] = await Promise.all([
    repo.findIdenticalHistorySince(Number(proposed_changes_id), Number(auth_id), status, note || "", oneMinuteAgo),
    repo.findApprovalsByProposedId(Number(proposed_changes_id)),
  ]);

  if (existingIdenticalHistory) {
    const updatedProposedChange = await getUpdatedProposedChange(Number(proposed_changes_id));
    return {
      message: `Approval has been updated successfully (duplicate submission prevented)`,
      data: updatedProposedChange,
    };
  }

  const currentStep = currentApproval.step || 0;
  const nextApprovalStep = currentStep + 1;

  const totalSteps = allApprovals.length;
  // hanya 'approved' yang dihitung selesai (approval saat ini dihitung dengan status barunya)
  const completedSteps = allApprovals.filter((approval) =>
    approval.id === currentApproval.id ? status === "approved" : approval.status === "approved",
  ).length;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  let transactionSuccessful = false;
  let transactionError = null;
  const maxTransactionAttempts = 3;
  let transactionAttempt = 0;

  while (transactionAttempt < maxTransactionAttempts && !transactionSuccessful) {
    try {
      await repo.runSerializable(async (tx) => {
        // cek duplikat lagi di dalam transaksi
        const duplicateCheck = await repo.findIdenticalHistorySince(
          Number(proposed_changes_id), Number(auth_id), status, note || "", oneMinuteAgo, tx,
        );
        if (duplicateCheck) {
          transactionSuccessful = true;
          return;
        }

        await repo.updateApprovalStatus(tx, currentApproval.id, status, currentTimestamp);

        let newProposedStatus = "onprogress";

        // lanjut ke step berikutnya hanya kalau 'approved'
        if (status === "approved") {
          const nextApproval = await repo.findApprovalByStep(tx, Number(proposed_changes_id), nextApprovalStep);
          if (nextApproval) {
            if (!validStatuses.includes(nextApproval.status ?? "")) {
              await repo.updateApprovalStatus(tx, nextApproval.id, "on_going", currentTimestamp);
            }
          } else {
            newProposedStatus = "done";
          }
        }

        if (status === "not_approved") {
          newProposedStatus = "not_approved";
        } else if (status === "rejected") {
          newProposedStatus = "rejected";
        } else if (status === "approved" && progressPercentage === 100 && newProposedStatus !== "done") {
          newProposedStatus = "approved";
        }

        const hasRejections = allApprovals.some((approval) =>
          approval.id === currentApproval.id ? status === "rejected" : approval.status === "rejected",
        );
        const hasNotApproved = allApprovals.some((approval) =>
          approval.id === currentApproval.id ? status === "not_approved" : approval.status === "not_approved",
        );
        if (hasRejections) {
          newProposedStatus = "rejected";
        } else if (hasNotApproved) {
          newProposedStatus = "not_approved";
        }

        await repo.updateProposedChangeStatus(tx, Number(proposed_changes_id), newProposedStatus, `${progressPercentage}%`, currentTimestamp);

        const previousNotApproved = await repo.findNotApprovedHistory(tx, Number(proposed_changes_id), Number(auth_id));
        const authorization = await repo.findAuthorizationWithEmployee(tx, Number(auth_id));
        const authName = authorization?.employee_name;

        let description = "";
        if (status === "approved") {
          description = `${authName} has approved the Proposed Changes`;
        } else if (status === "not_approved") {
          description = previousNotApproved
            ? `${authName} not approved again the Proposed Changes`
            : `${authName} has not approved the Proposed Changes`;
        } else if (status === "rejected") {
          description = `${authName} has rejected the Proposed Changes`;
        }

        await repo.createHistory(tx, {
          proposed_changes_id: Number(proposed_changes_id),
          auth_id: Number(auth_id),
          employee_code: employee_code || authorization?.employee_code || "",
          status,
          note: note || "",
          description,
          created_date: currentTimestamp,
          updated_date: currentTimestamp,
        });

        transactionSuccessful = true;
      });
      break;
    } catch (error: any) {
      console.error(`❌ Transaction error attempt #${transactionAttempt + 1}:`, error);
      transactionError = error;

      // P2034 = transaksi gagal karena modifikasi bersamaan → retry dengan backoff
      if (error.code === "P2034") {
        if (transactionAttempt < maxTransactionAttempts - 1) {
          const delay = Math.pow(2, transactionAttempt) * 500; // 500ms, 1000ms, 2000ms
          await new Promise((resolve) => setTimeout(resolve, delay));
          transactionAttempt++;
        } else {
          console.error("❌ Max retry attempts reached, throwing error");
          throw error;
        }
      } else {
        console.error("❌ Non-retriable error occurred:", error);
        throw error;
      }
    }
  }

  if (!transactionSuccessful && transactionError) throw transactionError;

  const updatedProposedChange = await getUpdatedProposedChange(Number(proposed_changes_id));

  // email gagal tidak memblokir proses utama
  try {
    await sendApprovalEmails(Number(proposed_changes_id), Number(auth_id), status, currentStep, note);
  } catch (emailError) {
    console.error("❌ Error sending email notification:", emailError);
    console.error("❌ Email error details:", emailError instanceof Error ? emailError.message : String(emailError));
  }

  return {
    message: `Approval has been updated to '${status}' successfully`,
    data: updatedProposedChange,
  };
}

async function getUpdatedProposedChange(proposedChangesId: number) {
  try {
    return await repo.findWithAllRelations(proposedChangesId);
  } catch (error) {
    console.error("❌ [getUpdatedProposedChange] Error retrieving proposed change:", error);
    throw error;
  }
}
