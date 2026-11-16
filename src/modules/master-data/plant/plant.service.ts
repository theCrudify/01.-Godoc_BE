import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./plant.repository";

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = query.search as string;
  const code = query.code as string;
  const name = query.name as string;

  const where = {
    AND: [
      ...(code ? [{ plant_code: { equals: code } }] : []),
      ...(name ? [{ plant_name: { equals: name } }] : []),
    ],
    OR: searchTerm
      ? [
          { plant_code: { contains: searchTerm } },
          { plant_name: { contains: searchTerm } },
          { address: { contains: searchTerm } },
        ]
      : undefined,
  };

  const [plants, totalCount] = await repo.findPage(where, (page - 1) * limit, limit);
  return {
    data: plants,
    pagination: {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      limit,
      hasNextPage: page * limit < totalCount,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getById(rawId: string) {
  const plantId = Number(rawId);
  if (isNaN(plantId)) throw new HttpError(400, { error: "Invalid Plant ID" });
  const plant = await repo.findById(plantId);
  if (!plant) throw new HttpError(404, { error: "Plant not found" });
  return plant;
}
