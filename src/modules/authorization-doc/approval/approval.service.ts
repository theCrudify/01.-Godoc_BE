import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approval.repository";
import { sendApprovalEmails } from "./approval.mail";
import { OngoingAuthDocQuery, UpdateApprovalStatusDto } from "./approval.dto";

const VALID_SORT_COLUMNS = [
  "id", "doc_number", "implementation_date", "concept",
  "method", "status", "progress", "created_date",
  "plant_id", "department_id", "section_department_id",
];

/** Daftar dokumen untuk approver (filter approval_auth_id = dokumen yang menunggu aksi approver tsb). */
export async function listOngoing(query: OngoingAuthDocQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const orderBy: any = VALID_SORT_COLUMNS.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const whereCondition: any = {};
  const andConditions: any[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { doc_number: { contains: searchTerm } },
        { evaluation: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { conclution: { contains: searchTerm } },
        { concept: { contains: searchTerm } },
        { standart: { contains: searchTerm } },
        { method: { contains: searchTerm } },
        { status: { contains: searchTerm } },
        { progress: { contains: searchTerm } },
        { created_by: { contains: searchTerm } },
        { proposedChange: { project_name: { contains: searchTerm } } },
      ],
    });
  }

  if (query.proposed_change_id) andConditions.push({ proposed_change_id: Number(query.proposed_change_id) });
  if (query.doc_number) andConditions.push({ doc_number: query.doc_number as string });
  if (query.status) andConditions.push({ status: query.status as string });
  if (query.progress) andConditions.push({ progress: query.progress as string });
  if (query.plant_id) andConditions.push({ plant_id: Number(query.plant_id) });
  if (query.auth_id) andConditions.push({ auth_id: Number(query.auth_id) });
  if (query.department_id) andConditions.push({ department_id: Number(query.department_id) });
  if (query.section_department_id) andConditions.push({ section_department_id: Number(query.section_department_id) });
  if (query.created_by) andConditions.push({ created_by: query.created_by as string });

  if (query.approval_auth_id) {
    andConditions.push({
      authdocApprovals: {
        some: {
          auth_id: Number(query.approval_auth_id),
          // saat deploy: ['on_going', 'not_approved']
          status: { in: ["on_going", "not_approved", "rejected"] },
        },
      },
    });
  }

  if (query.id) andConditions.push({ id: Number(query.id) });
  if (query.approval_status) andConditions.push({ authdocApprovals: { some: { status: query.approval_status as string } } });
  if (query.employee_code) andConditions.push({ authdocApprovals: { some: { employee_code: query.employee_code as string } } });

  if (andConditions.length > 0) whereCondition.AND = andConditions;

  const [data, totalCount] = await repo.findOngoingPage(whereCondition, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

const getUpdatedAuthDoc = async (authdocId: number) => {
  try {
    return await repo.findDocFull(authdocId);
  } catch (error) {
    console.error("❌ [getUpdatedAuthDoc] Error retrieving auth doc:", error);
    throw error;
  }
};

const VALID_STATUSES = ["approved", "not_approved", "rejected"];

/** Approve / not approve / reject satu step, lalu hitung ulang status & progress dokumen. */
export async function updateStatus(body: UpdateApprovalStatusDto) {
  const { authdoc_id, auth_id, status, note, employee_code } = body;

  if (!authdoc_id || !auth_id || !status) {
    throw new HttpError(400, {
      error: "Bad Request",
      message: "Required parameters missing: authdoc_id, auth_id, and status are required",
    });
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new HttpError(400, {
      error: "Bad Request",
      message: `Invalid status. Status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const currentApproval = await repo.findApprovalOf(Number(authdoc_id), Number(auth_id));
  if (!currentApproval) {
    throw new HttpError(404, { error: "Not Found", message: "No approval found with the provided authdoc_id and auth_id" });
  }

  if (currentApproval.status === "approved") {
    throw new HttpError(400, { error: "Bad Request", message: "Cannot change status from 'approved' to another status" });
  }

  const currentTimestamp = new Date();
  const oneMinuteAgo = new Date(currentTimestamp.getTime() - 60000);
  const identical = { authdoc_id: Number(authdoc_id), auth_id: Number(auth_id), status, note: note || "", since: oneMinuteAgo };

  const [existingIdenticalHistory, allApprovals] = await Promise.all([
    repo.findRecentIdenticalHistory(identical),
    repo.findApprovalsOfDoc(Number(authdoc_id)),
  ]);

  if (existingIdenticalHistory) {
    return {
      message: `Approval has been updated successfully (duplicate submission prevented)`,
      data: await getUpdatedAuthDoc(Number(authdoc_id)),
    };
  }

  const currentStep = currentApproval.step || 0;
  const nextApprovalStep = currentStep + 1;
  const totalSteps = allApprovals.length;

  // hanya status 'approved' yang dihitung selesai (current dihitung bila status baru 'approved')
  const completedSteps = allApprovals.filter((approval) =>
    approval.id === currentApproval.id ? status === "approved" : approval.status === "approved",
  ).length;

  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  let transactionAttempt = 0;
  const maxTransactionAttempts = 3;
  let transactionSuccessful = false;
  let transactionError: any = null;

  while (transactionAttempt < maxTransactionAttempts && !transactionSuccessful) {
    transactionAttempt++;
    try {
      await repo.runSerializable(async (tx) => {
        // cek duplikat lagi di dalam transaksi
        const duplicateCheck = await repo.findRecentIdenticalHistory(identical, tx);
        if (duplicateCheck) {
          transactionSuccessful = true;
          return;
        }

        const freshApproval = await repo.findApprovalById(tx, currentApproval.id);
        if (!freshApproval) throw new Error("Approval record not found in transaction");
        if (freshApproval.status === "approved") {
          transactionSuccessful = true;
          return;
        }

        await repo.updateApproval(tx, currentApproval.id, { status, updated_date: currentTimestamp });

        let newAuthDocStatus = "onprogress";

        if (status === "approved") {
          const nextApproval = await repo.findApprovalAtStep(tx, Number(authdoc_id), nextApprovalStep);
          if (nextApproval) {
            // step berikutnya jadi on_going hanya bila belum punya status final
            if (!VALID_STATUSES.includes(nextApproval.status ?? "")) {
              await repo.updateApproval(tx, nextApproval.id, { status: "on_going", updated_date: currentTimestamp });
            }
          } else {
            newAuthDocStatus = "done";
          }
        }

        if (status === "not_approved") {
          newAuthDocStatus = "not_approved";
        } else if (status === "rejected") {
          newAuthDocStatus = "rejected";
        } else if (status === "approved" && progressPercentage === 100 && newAuthDocStatus !== "done") {
          newAuthDocStatus = "approved";
        }

        const hasRejections = allApprovals.some((approval) =>
          approval.id === currentApproval.id ? status === "rejected" : approval.status === "rejected",
        );
        const hasNotApproved = allApprovals.some((approval) =>
          approval.id === currentApproval.id ? status === "not_approved" : approval.status === "not_approved",
        );

        if (hasRejections) {
          newAuthDocStatus = "rejected";
        } else if (hasNotApproved) {
          newAuthDocStatus = "not_approved";
        }

        await repo.updateDoc(tx, Number(authdoc_id), {
          status: newAuthDocStatus,
          progress: `${progressPercentage}%`,
          updated_at: currentTimestamp,
        });

        const previousNotApproved = await repo.findNotApprovedHistoryOf(tx, Number(authdoc_id), Number(auth_id));
        const authorization = await repo.findAuthorization(tx, Number(auth_id));
        const authName = authorization?.employee_name;

        let description = "";
        if (status === "approved") {
          description = `${authName} has approved the Authorization Document`;
        } else if (status === "not_approved") {
          description = previousNotApproved
            ? `${authName} not approved again the Authorization Document`
            : `${authName} has not approved the Authorization Document`;
        } else if (status === "rejected") {
          description = `${authName} has rejected the Authorization Document`;
        }

        await repo.createHistory(tx, {
          authdoc_id: Number(authdoc_id),
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
      console.error(`❌ Transaction error attempt #${transactionAttempt}:`, error);
      transactionError = error;

      if (error.code === "P2034") {
        // konflik serialisasi: retry dengan exponential backoff + jitter
        if (transactionAttempt < maxTransactionAttempts) {
          const delay = Math.pow(2, transactionAttempt) * 500 + Math.floor(Math.random() * 300);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("❌ Max retry attempts reached");
          break;
        }
      } else {
        console.error("❌ Non-retriable error occurred:", error);
        break;
      }
    }
  }

  if (!transactionSuccessful) {
    throw transactionError ?? new Error("Transaction failed after all retry attempts");
  }

  const updatedAuthDoc = await getUpdatedAuthDoc(Number(authdoc_id));

  try {
    const authDoc = await repo.findDocProposedChangeId(Number(authdoc_id));
    // email hanya untuk dokumen yang terhubung ke proposed change; kirim id auth doc, bukan proposed change
    if (authDoc?.proposed_change_id) {
      await sendApprovalEmails(Number(authDoc.id), Number(auth_id), status as any, currentStep, note || "");
    }
  } catch (emailError) {
    console.error("❌ Error sending email notification:", emailError);
    console.error("❌ Email error details:", emailError instanceof Error ? emailError.message : String(emailError));
  }

  return { message: `Approval has been updated to '${status}' successfully`, data: updatedAuthDoc };
}
