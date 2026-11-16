import { prismaDB2 } from "../../shared/config/database";

// Akses data tr_authorization_doc & tabel terkait — hanya query Prisma, tanpa logika bisnis.

const membersSelect = {
  where: { is_deleted: false },
  select: { id: true, employee_code: true, employee_name: true, status: true, created_date: true },
};
const proposedChangeSelect = { select: { id: true, project_name: true } };
const authorizationSelect = {
  select: { id: true, employee_name: true, employee_code: true, email: true, gender: true },
};

// ---------- template approval & heads ----------

export const findDefaultTemplates = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { line_code: null, is_insert_step: false, is_active: true, is_deleted: false },
    orderBy: { step_order: "asc" },
  });

export const findInsertStepTemplates = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { is_insert_step: true, is_active: true, is_deleted: false },
  });

const headInclude = {
  authorization: { select: { id: true, employee_code: true, employee_name: true, status: true } },
  section: {
    select: {
      id: true,
      department_id: true,
      section_name: true,
      department: { select: { department_name: true } },
    },
  },
};

export const findSectionHeads = (sectionId: number) =>
  prismaDB2.mst_section_head.findMany({ where: { is_deleted: false, section_id: sectionId }, include: headInclude });

export const findDepartmentHeads = (sectionId: number) =>
  prismaDB2.mst_department_head.findMany({ where: { is_deleted: false, section_id: sectionId }, include: headInclude });

// ---------- authorization (user) ----------

export const findEmployeeName = (authId: number) =>
  prismaDB2.mst_authorization.findUnique({ where: { id: authId }, select: { employee_name: true } });

export const findAuthorizationById = (authId: number) => prismaDB2.mst_authorization.findUnique({ where: { id: authId } });

export const findAuthorizationsByIds = (ids: number[]) => prismaDB2.mst_authorization.findMany({ where: { id: { in: ids } } });

// ---------- tr_authorization_doc ----------

export const createDoc = (data: any) => prismaDB2.tr_authorization_doc.create({ data });

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_authorization_doc.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        authorizationPlant: true,
        department: true,
        section_department: true,
        proposedChange: { select: { project_name: true } },
      },
    }),
    prismaDB2.tr_authorization_doc.count({ where }),
  ]);

export const findByIdWithMembers = (id: number) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    include: { proposedChange: proposedChangeSelect, authdocMembers: membersSelect },
  });

export const findByIdWithAuthorization = (id: number) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    include: { proposedChange: proposedChangeSelect, authorization: authorizationSelect },
  });

export const updateById = (id: number, data: any) =>
  prismaDB2.tr_authorization_doc.update({
    where: { id },
    data,
    include: { proposedChange: proposedChangeSelect, authdocMembers: membersSelect, authorization: authorizationSelect },
  });

export const findDoneByAuthId = (authId: number) =>
  prismaDB2.tr_authorization_doc.findMany({
    where: {
      auth_id: authId,
      progress: "100%",
      status: "done",
      // dokumen yang sudah dipakai tr_handover tidak ditampilkan
      tr_handover: { none: {} },
    },
    include: { proposedChange: true },
    orderBy: { created_date: "desc" },
  });

export const findForSubmissionEmail = (id: number) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    include: {
      proposedChange: true,
      authdocApprovals: { include: { authorization: true }, orderBy: { step: "asc" } },
    },
  });

// ---------- members ----------

export const createMembers = (data: any[]) => prismaDB2.tr_authdoc_member.createMany({ data, skipDuplicates: true });

export const updateMember = (id: number, data: any) => prismaDB2.tr_authdoc_member.update({ where: { id }, data });

export const createMember = (data: any) => prismaDB2.tr_authdoc_member.create({ data });

export const softDeleteMember = (id: number) =>
  prismaDB2.tr_authdoc_member.update({ where: { id }, data: { is_deleted: true } });

// ---------- history & approval ----------

export const createHistory = (data: any) => prismaDB2.tr_authdoc_history.create({ data });

export const findHistories = (authdocId: number) =>
  prismaDB2.tr_authdoc_history.findMany({ where: { authdoc_id: authdocId }, orderBy: { created_date: "desc" } });

export const createApprovals = (data: any[]) => prismaDB2.tr_authdoc_approval.createMany({ data });

export const findApprovals = (authdocId: number) =>
  prismaDB2.tr_authdoc_approval.findMany({
    where: { authdoc_id: authdocId },
    include: { authorization: true },
    orderBy: { created_date: "desc" },
  });

export const findNotApprovedApprovals = (authdocId: number) =>
  prismaDB2.tr_authdoc_approval.findMany({
    where: { authdoc_id: authdocId, status: "not_approved" },
    distinct: ["auth_id"],
    orderBy: { updated_date: "desc" },
  });

export const findNotApprovedHistoriesOf = (authdocId: number, authIds: number[]) =>
  prismaDB2.tr_authdoc_history.findMany({
    where: { authdoc_id: authdocId, auth_id: { in: authIds }, status: "not_approved" },
    orderBy: { created_date: "desc" },
  });

export const findNotApprovedHistoriesDistinct = (authdocId: number) =>
  prismaDB2.tr_authdoc_history.findMany({
    where: { authdoc_id: authdocId, status: "not_approved" },
    distinct: ["auth_id"],
    orderBy: { created_date: "desc" },
  });
