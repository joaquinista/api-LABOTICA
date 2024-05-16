import { Prisma } from "@prisma/client";
import prisma from "../db/index.js";

export const saveLogs = async (data: Prisma.LogCreateInput[]) => {
  console.log("Logs generated!");
  console.log(
    `warnings: ${data.filter((log) => log.type === "warning").length}`
  );
  console.log(`errors: ${data.filter((log) => log.type === "error").length}`);
  console.log(`infos: ${data.filter((log) => log.type === "info").length}`);

  await prisma.log.createMany({
    data,
  });
};
