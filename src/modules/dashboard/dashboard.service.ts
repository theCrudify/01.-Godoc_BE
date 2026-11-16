import { startOfMonth, endOfMonth, format, subMonths, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./dashboard.repository";
import {
  generateColors,
  groupDocumentsByTimePeriod,
  prepareMonthlyData,
  summarizeByDepartment,
  summarizeByStatus,
} from "./dashboard.utils";

// Validasi query/params tetap di sini: body 400-nya khusus ({ status: "error", message }).

// ===== Document levelling =====

export async function getDocumentStatusMapping() {
  const [totalDocuments, proposedChangesStage, authorizationStage, handoverStage, completedDocuments] =
    await repo.countDocumentStages();

  return {
    totalDocuments,
    documentsByStage: {
      proposedChanges: proposedChangesStage,
      authorization: authorizationStage,
      handover: handoverStage,
      completed: completedDocuments,
    },
  };
}

// ===== Department involvement =====

export async function getDepartmentInvolvement() {
  const departments = await repo.findActiveDepartments();

  // 5 groupBy untuk semua departemen sekaligus (bukan 5 count per departemen)
  const deptIds = departments.map((d) => d.id);
  const countByDept = async (where: object) => {
    const rows = await repo.countProposedChangesByDepartment(where, deptIds);
    return new Map(rows.map((r) => [r.department_id, r._count._all]));
  };
  const [totalMap, proposedOnlyMap, authOnlyMap, handoverNotFinishedMap, completedMap] = await Promise.all([
    // A. Total dokumen
    countByDept({}),
    // B. Masih di tahap proposed changes (belum punya authorization doc)
    countByDept({ authorizationDocs: { none: {} } }),
    // C. Tahap authorization (punya authorization doc tapi belum handover)
    countByDept({ authorizationDocs: { some: {} }, tr_handover: { none: {} } }),
    // D. Tahap handover tapi belum selesai
    countByDept({ tr_handover: { some: { is_finished: false } } }),
    // E. Sudah selesai
    countByDept({ tr_handover: { some: { is_finished: true } } }),
  ]);

  const result = departments.map((dept) => {
    const totalDocuments = totalMap.get(dept.id) || 0;
    const proposedOnly = proposedOnlyMap.get(dept.id) || 0;
    const authOnly = authOnlyMap.get(dept.id) || 0;
    const handoverNotFinished = handoverNotFinishedMap.get(dept.id) || 0;
    const completed = completedMap.get(dept.id) || 0;

    return {
      department_id: dept.id,
      department_name: dept.department_name,
      department_code: dept.department_code,
      plant_name: dept.plant?.plant_name || "-",
      total_dokumen: totalDocuments,
      status_dokumen: {
        tahap_proposed_changes: proposedOnly,
        tahap_authorization: authOnly,
        tahap_handover: handoverNotFinished,
        sudah_selesai: completed,
      },
      total_by_status: proposedOnly + authOnly + handoverNotFinished + completed,
    };
  });

  result.sort((a, b) => b.total_dokumen - a.total_dokumen);
  return result;
}

export async function getDepartmentInvolvementDetail(rawId: string) {
  const departmentId = parseInt(rawId);
  if (isNaN(departmentId)) {
    throw new HttpError(400, { status: "error", message: "ID departemen tidak valid" });
  }

  const department = await repo.findDepartmentById(departmentId);
  if (!department) {
    throw new HttpError(404, { status: "error", message: `Departemen dengan ID ${departmentId} tidak ditemukan` });
  }

  const allProposedChanges = await repo.findDepartmentProposedChanges(departmentId);

  const toItem = (pc: (typeof allProposedChanges)[number]) => ({
    id: pc.id,
    nama_proyek: pc.project_name,
    nomor_dokumen: pc.documentNumber?.running_number || "-",
    status: pc.status,
    progress: pc.progress,
    tanggal_dibuat: pc.created_date,
  });

  const proposedOnly = allProposedChanges.filter((pc) => pc.authorizationDocs.length === 0).map(toItem);
  const authOnly = allProposedChanges
    .filter((pc) => pc.authorizationDocs.length > 0 && pc.tr_handover.length === 0)
    .map(toItem);
  const handoverNotFinished = allProposedChanges
    .filter((pc) => pc.tr_handover.length > 0 && !pc.tr_handover.some((h) => h.is_finished === true))
    .map(toItem);
  const completed = allProposedChanges.filter((pc) => pc.tr_handover.some((h) => h.is_finished === true)).map(toItem);

  return {
    departemen: {
      id: department.id,
      nama: department.department_name,
      kode: department.department_code,
      plant: department.plant?.plant_name || "-",
    },
    statistik: {
      total_dokumen: allProposedChanges.length,
      tahap_proposed_changes: proposedOnly.length,
      tahap_authorization: authOnly.length,
      tahap_handover: handoverNotFinished.length,
      sudah_selesai: completed.length,
    },
    dokumen_per_tahap: {
      tahap_proposed_changes: proposedOnly,
      tahap_authorization: authOnly,
      tahap_handover: handoverNotFinished,
      sudah_selesai: completed,
    },
  };
}

// ===== Document statistics =====

export async function getDocumentTimeStatistics(query: any) {
  const {
    period = "daily", // monthly, weekly, daily, hourly
    start_date, // YYYY-MM-DD atau YYYY-MM-DD HH:mm:ss
    end_date,
    department_id,
    month, // 1-12
    year = new Date().getFullYear(),
  } = query;

  let startDate: Date;
  let endDate: Date;

  if (start_date && end_date) {
    startDate = parseISO(start_date as string);
    endDate = parseISO(end_date as string);
  } else if (month) {
    const monthNum = parseInt(month as string);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new HttpError(400, { status: "error", message: "Bulan harus berupa angka 1-12" });
    }
    const yearNum = parseInt(year as string);
    const monthDate = new Date(yearNum, monthNum - 1, 1);
    startDate = startOfMonth(monthDate);
    endDate = endOfMonth(monthDate);
  } else {
    // default: 6 bulan terakhir
    endDate = new Date();
    startDate = subMonths(endDate, 6);
  }

  const departmentFilter = department_id ? { department_id: parseInt(department_id as string) } : {};

  const [proposedChanges, authDocs, handovers] = await repo.findDocumentsForTimeStatistics(startDate, endDate, departmentFilter);

  const groupedData = groupDocumentsByTimePeriod(proposedChanges, authDocs, handovers, period as string, startDate, endDate);

  const summary = {
    total_proposed_changes: proposedChanges.length,
    total_authorization_docs: authDocs.length,
    total_handovers: handovers.length,
    total_completed: handovers.filter((h) => h.is_finished).length,
    department_summary: summarizeByDepartment(proposedChanges, authDocs, handovers),
    status_summary: {
      proposed_changes: summarizeByStatus(proposedChanges),
      authorization_docs: summarizeByStatus(authDocs),
      handovers: summarizeByStatus(handovers),
    },
  };

  return {
    period,
    date_range: {
      start: format(startDate, "yyyy-MM-dd HH:mm:ss"),
      end: format(endDate, "yyyy-MM-dd HH:mm:ss"),
    },
    summary,
    data: groupedData,
  };
}

export async function getDocumentTrends(query: any) {
  // 12 bulan terakhir termasuk bulan ini
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0); // hari terakhir bulan ini
  endDate.setHours(23, 59, 59, 999);

  const departmentId = query.department_id ? parseInt(query.department_id as string) : undefined;
  const departmentFilter = departmentId ? { department_id: departmentId } : {};

  const [proposedChanges, authDocs, handovers] = await repo.findDocumentsForTrends(startDate, endDate, departmentFilter);

  return {
    date_range: {
      start: format(startDate, "MMMM yyyy", { locale: id }),
      end: format(endDate, "MMMM yyyy", { locale: id }),
    },
    department_id: departmentId,
    data: prepareMonthlyData(startDate, endDate, proposedChanges, authDocs, handovers),
  };
}

// ===== Top performers =====

export async function getTopHandoverSubmitters(query: any) {
  const limit = Number(query.limit) || 10;
  const dateFrom = query.date_from ? new Date(query.date_from as string) : undefined;
  const dateTo = query.date_to ? new Date(query.date_to as string) : undefined;
  const minRating = query.min_rating ? parseFloat(query.min_rating as string) : undefined;
  const minDocuments = query.min_documents ? parseInt(query.min_documents as string) : 1;

  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const whereCondition: any = {
    is_deleted: false,
    is_finished: true, // hanya handover selesai yang punya rating
    star: { not: null },
  };
  if (Object.keys(dateFilter).length > 0) whereCondition.created_date = dateFilter;
  if (minRating !== undefined) whereCondition.star = { ...whereCondition.star, gte: minRating };

  const authIdResults = await repo.groupHandoversBySubmitter(whereCondition);
  const filteredAuthIds = authIdResults.filter((item) => item._count.id >= minDocuments);

  // Batched: satu query user + satu query handover (bukan 2 per submitter)
  const submitterIds = filteredAuthIds.map((item) => item.auth_id).filter((id): id is number => !!id);
  const [submitterUsers, allHandoverDetails] = await repo.findSubmitterDetails(submitterIds);
  const submitterUserMap = new Map(submitterUsers.map((u) => [u.id, u]));
  const handoversByAuth = new Map<number, typeof allHandoverDetails>();
  for (const h of allHandoverDetails) {
    if (h.auth_id == null) continue;
    const list = handoversByAuth.get(h.auth_id);
    if (list) list.push(h); else handoversByAuth.set(h.auth_id, [h]);
  }

  const submitterDetails = filteredAuthIds.map((item) => {
    if (!item.auth_id) return null;

    const user = submitterUserMap.get(item.auth_id);
    if (!user) return null;

    const handoverDetails = handoversByAuth.get(item.auth_id) || [];

    const bestHandover = handoverDetails.length > 0 ? handoverDetails[0] : null;
    const worstHandover = handoverDetails.length > 0
      ? handoverDetails.reduce((prev, curr) => ((curr.star || 0) < (prev.star || 0) ? curr : prev), handoverDetails[0])
      : null;

    return {
      user: {
        id: user.id,
        employee_code: user.employee_code,
        employee_name: user.employee_name,
        email: user.email,
        department: user.department,
      },
      stats: {
        total_handovers: item._count.id,
        average_rating: item._avg.star ? parseFloat(item._avg.star.toFixed(2)) : 0,
        best_rating: bestHandover?.star || 0,
        worst_rating: worstHandover?.star || 0,
      },
      best_handover: bestHandover ? {
        id: bestHandover.id,
        doc_number: bestHandover.doc_number,
        rating: bestHandover.star,
        project_name: bestHandover.tr_proposed_changes?.project_name || "Unknown",
        finished_date: bestHandover.finished_date,
      } : null,
      worst_handover: worstHandover && worstHandover.id !== bestHandover?.id ? {
        id: worstHandover.id,
        doc_number: worstHandover.doc_number,
        rating: worstHandover.star,
        project_name: worstHandover.tr_proposed_changes?.project_name || "Unknown",
        finished_date: worstHandover.finished_date,
      } : null,
    };
  });

  // Urutkan: rata-rata rating desc, lalu total handover desc
  const sortedSubmitters = submitterDetails
    .filter((item) => item !== null)
    .sort((a, b) => {
      const ratingDiff = (b?.stats.average_rating || 0) - (a?.stats.average_rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b?.stats.total_handovers || 0) - (a?.stats.total_handovers || 0);
    });

  const submitters = sortedSubmitters.slice(0, limit).map((item, index) => ({ rank: index + 1, ...item }));

  return {
    filters: {
      date_from: dateFrom?.toISOString() || null,
      date_to: dateTo?.toISOString() || null,
      min_rating: minRating,
      min_documents: minDocuments,
      limit: limit,
    },
    data: submitters,
  };
}

export async function getTopHandoverApprovers(query: any) {
  const limit = Number(query.limit) || 10;
  const dateFrom = query.date_from ? new Date(query.date_from as string) : undefined;
  const dateTo = query.date_to ? new Date(query.date_to as string) : undefined;
  const minDocuments = query.min_documents ? parseInt(query.min_documents as string) : 1;

  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  const whereCondition: any = {
    status: "approved",
    rating: { not: null }, // hanya approval yang memberi rating
  };
  if (Object.keys(dateFilter).length > 0) whereCondition.tr_handover = { created_date: dateFilter };

  const approverStats = await repo.groupApprovalsByApprover(whereCondition);
  const filteredApprovers = approverStats.filter((item) => item._count.id >= minDocuments && item.auth_id !== null);

  // Batched: satu query user + satu query approval (bukan 2 per approver)
  const approverIds = filteredApprovers.map((item) => item.auth_id).filter((id): id is number => !!id);
  const [approverUsers, allApprovalDetails] = await repo.findApproverDetails(approverIds);
  const approverUserMap = new Map(approverUsers.map((u) => [u.id, u]));
  const approvalsByAuth = new Map<number, typeof allApprovalDetails>();
  for (const a of allApprovalDetails) {
    if (a.auth_id == null) continue;
    const list = approvalsByAuth.get(a.auth_id);
    if (list) list.push(a); else approvalsByAuth.set(a.auth_id, [a]);
  }

  const approverDetails = filteredApprovers.map((item) => {
    if (!item.auth_id) return null;

    const user = approverUserMap.get(item.auth_id);
    if (!user) return null;

    const approvalDetails = approvalsByAuth.get(item.auth_id) || [];

    const highestApproval = approvalDetails.length > 0 ? approvalDetails[0] : null;
    const lowestApproval = approvalDetails.length > 0
      ? approvalDetails.reduce((prev, curr) => ((curr.rating || 0) < (prev.rating || 0) ? curr : prev), approvalDetails[0])
      : null;

    return {
      user: {
        id: user.id,
        employee_code: user.employee_code,
        employee_name: user.employee_name,
        email: user.email,
        department: user.department,
      },
      stats: {
        total_approvals: item._count.id,
        average_rating: item._avg.rating ? parseFloat(item._avg.rating.toFixed(2)) : 0,
        highest_rating: highestApproval?.rating || 0,
        lowest_rating: lowestApproval?.rating || 0,
      },
      highest_rated: highestApproval ? {
        id: highestApproval.id,
        handover_id: highestApproval.tr_handover?.id,
        doc_number: highestApproval.tr_handover?.doc_number,
        rating: highestApproval.rating,
        review: highestApproval.review,
        project_name: highestApproval.tr_handover?.tr_proposed_changes?.project_name || "Unknown",
        rated_date: highestApproval.updated_date,
      } : null,
      lowest_rated: lowestApproval && lowestApproval.id !== highestApproval?.id ? {
        id: lowestApproval.id,
        handover_id: lowestApproval.tr_handover?.id,
        doc_number: lowestApproval.tr_handover?.doc_number,
        rating: lowestApproval.rating,
        review: lowestApproval.review,
        project_name: lowestApproval.tr_handover?.tr_proposed_changes?.project_name || "Unknown",
        rated_date: lowestApproval.updated_date,
      } : null,
    };
  });

  // Urutkan: rata-rata rating desc, lalu total approval desc
  const sortedApprovers = approverDetails
    .filter((item) => item !== null)
    .sort((a, b) => {
      const ratingDiff = (b?.stats.average_rating || 0) - (a?.stats.average_rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b?.stats.total_approvals || 0) - (a?.stats.total_approvals || 0);
    });

  const approvers = sortedApprovers.slice(0, limit).map((item, index) => ({ rank: index + 1, ...item }));

  return {
    filters: {
      date_from: dateFrom?.toISOString() || null,
      date_to: dateTo?.toISOString() || null,
      min_documents: minDocuments,
      limit: limit,
    },
    data: approvers,
  };
}

// ===== Line code statistics =====

export async function getLineCodeStatistics(query: any) {
  const { status, exclude_done, department_id, limit } = query;

  const whereCondition: any = { is_deleted: false };
  if (status) whereCondition.status = status as string;
  if (exclude_done === "true") whereCondition.status = { not: "done" };
  if (department_id) whereCondition.department_id = parseInt(department_id as string);

  const allProposedChanges = await repo.findProposedChangesForLineStats(whereCondition);

  // Kelompokkan berdasarkan line_code
  const lineCodeGroups: { [key: string]: any[] } = {};
  allProposedChanges.forEach((doc) => {
    const lineCode = doc.line_code || "Unknown";
    if (!lineCodeGroups[lineCode]) lineCodeGroups[lineCode] = [];
    lineCodeGroups[lineCode].push(doc);
  });

  let lineCodeStats = Object.keys(lineCodeGroups).map((lineCode) => {
    const documents = lineCodeGroups[lineCode];
    const totalDocuments = documents.length;

    const statusCount: { [key: string]: number } = {};
    documents.forEach((doc) => {
      const status = doc.status || "unknown";
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    const percentage = (totalDocuments / allProposedChanges.length) * 100;

    // 5 dokumen terbaru sebagai sampel
    const recentDocuments = documents
      .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
      .slice(0, 5)
      .map((doc) => ({
        id: doc.id,
        project_name: doc.project_name,
        status: doc.status,
        created_date: doc.created_date,
      }));

    return {
      line_code: lineCode,
      total_documents: totalDocuments,
      percentage: parseFloat(percentage.toFixed(2)),
      status_breakdown: statusCount,
      recent_documents: recentDocuments,
    };
  });

  lineCodeStats = lineCodeStats.sort((a, b) => b.total_documents - a.total_documents);

  // Batasi jumlah line_code; sisanya digabung ke "Others"
  const limitNum = limit ? parseInt(limit as string) : lineCodeStats.length;
  if (limitNum < lineCodeStats.length) {
    const topLineCodeStats = lineCodeStats.slice(0, limitNum);
    const otherLineCodeStats = lineCodeStats.slice(limitNum);

    if (otherLineCodeStats.length > 0) {
      const totalOtherDocuments = otherLineCodeStats.reduce((sum, item) => sum + item.total_documents, 0);
      const otherPercentage = (totalOtherDocuments / allProposedChanges.length) * 100;

      const otherStatusBreakdown: { [key: string]: number } = {};
      otherLineCodeStats.forEach((item) => {
        Object.keys(item.status_breakdown).forEach((status) => {
          otherStatusBreakdown[status] = (otherStatusBreakdown[status] || 0) + item.status_breakdown[status];
        });
      });

      const otherRecentDocs = otherLineCodeStats
        .flatMap((item) => item.recent_documents)
        .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
        .slice(0, 5);

      topLineCodeStats.push({
        line_code: "Others",
        total_documents: totalOtherDocuments,
        percentage: parseFloat(otherPercentage.toFixed(2)),
        status_breakdown: otherStatusBreakdown,
        recent_documents: otherRecentDocs,
      });

      lineCodeStats = topLineCodeStats;
    }
  }

  const chartData = {
    labels: lineCodeStats.map((item) => item.line_code),
    datasets: [
      {
        data: lineCodeStats.map((item) => item.total_documents),
        backgroundColor: generateColors(lineCodeStats.length),
      },
    ],
  };

  const statusSummary: { [key: string]: number } = {};
  allProposedChanges.forEach((doc) => {
    const status = doc.status || "unknown";
    statusSummary[status] = (statusSummary[status] || 0) + 1;
  });

  return {
    summary: {
      total_documents: allProposedChanges.length,
      total_line_codes: Object.keys(lineCodeGroups).length,
      status_summary: statusSummary,
    },
    data: lineCodeStats,
    chart_data: chartData,
  };
}

export async function getLineCodeStatusFlow(query: any) {
  const { department_id } = query;

  const whereCondition: any = { is_deleted: false };
  if (department_id) whereCondition.department_id = parseInt(department_id as string);

  const proposedChanges = await repo.findProposedChangesForLineFlow(whereCondition);

  const lineGroups: { [key: string]: any[] } = {};
  proposedChanges.forEach((doc) => {
    const lineCode = doc.line_code || "Unknown";
    if (!lineGroups[lineCode]) lineGroups[lineCode] = [];
    lineGroups[lineCode].push(doc);
  });

  const lineCodeFlowStats = Object.keys(lineGroups).map((lineCode) => {
    const documents = lineGroups[lineCode];
    const totalDocuments = documents.length;

    // Tahapan workflow
    const workflow = {
      proposed_only: documents.filter((doc) => doc.authorizationDocs.length === 0 && doc.tr_handover.length === 0).length,
      in_authorization: documents.filter((doc) => doc.authorizationDocs.length > 0 && doc.tr_handover.length === 0).length,
      in_handover: documents.filter(
        (doc) => doc.tr_handover.length > 0 && !doc.tr_handover.some((h: { is_finished: boolean }) => h.is_finished === true),
      ).length,
      completed: documents.filter((doc) => doc.tr_handover.some((h: { is_finished: boolean }) => h.is_finished === true)).length,
    };

    const completionRate = (workflow.completed / totalDocuments) * 100;

    const statusCounts: { [key: string]: number } = {};
    documents.forEach((doc) => {
      const status = doc.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      line_code: lineCode,
      total_documents: totalDocuments,
      workflow: workflow,
      completion_rate: parseFloat(completionRate.toFixed(2)),
      status_counts: statusCounts,
    };
  });

  const sortedResult = lineCodeFlowStats.sort((a, b) => b.total_documents - a.total_documents);

  const workflowChartData = {
    labels: sortedResult.map((item) => item.line_code),
    datasets: [
      { label: "Proposed Only", data: sortedResult.map((item) => item.workflow.proposed_only), backgroundColor: "#36A2EB" },
      { label: "In Authorization", data: sortedResult.map((item) => item.workflow.in_authorization), backgroundColor: "#FFCE56" },
      { label: "In Handover", data: sortedResult.map((item) => item.workflow.in_handover), backgroundColor: "#FF9F40" },
      { label: "Completed", data: sortedResult.map((item) => item.workflow.completed), backgroundColor: "#4BC0C0" },
    ],
  };

  const totalProposedOnly = sortedResult.reduce((sum, item) => sum + item.workflow.proposed_only, 0);
  const totalInAuthorization = sortedResult.reduce((sum, item) => sum + item.workflow.in_authorization, 0);
  const totalInHandover = sortedResult.reduce((sum, item) => sum + item.workflow.in_handover, 0);
  const totalCompleted = sortedResult.reduce((sum, item) => sum + item.workflow.completed, 0);
  const grandTotal = totalProposedOnly + totalInAuthorization + totalInHandover + totalCompleted;

  return {
    summary: {
      total_documents: grandTotal,
      total_line_codes: sortedResult.length,
      workflow_summary: {
        proposed_only: totalProposedOnly,
        in_authorization: totalInAuthorization,
        in_handover: totalInHandover,
        completed: totalCompleted,
      },
      completion_rate: parseFloat(((totalCompleted / grandTotal) * 100).toFixed(2)),
    },
    data: sortedResult,
    chart_data: workflowChartData,
  };
}
