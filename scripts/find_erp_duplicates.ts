import { erp } from "../dataSources/erp/index.js";
import { Product } from "../dataSources/erp/types.js";
import { saveLogs } from "../log/index.js";
import fs from "fs/promises";

export const findErpDuplicates = async () => {
  const products = await erp.getAllProducts();

  const map = new Map<string, Product[]>();

  products.forEach((product) => {
    const key = product.prd_alterna;
    const collection = map.get(key);
    if (collection) {
      collection.push(product);
    } else {
      map.set(key, [product]);
    }
  });

  const duplicates = Array.from(map.values()).filter(
    (collection) => collection.length > 1
  );

  console.log(`Found ${duplicates.length} duplicates`);

  await saveLogs([
    {
      type: "script:find_erp_duplicates:found_duplicates",
      message: `Se encontraron ${duplicates.length} productos duplicados en el ERP`,
      data: JSON.stringify(duplicates),
    },
  ]);

  const lines: string[] = [];
  for (const collection of duplicates) {
    lines.push(`Duplicados con codigo "${collection[0].prd_alterna}":`);
    collection.forEach((product) => {
      lines.push(`  id: ${product.prd_codigo} - nombre: ${product.prd_nombre}`);
    });
  }

  await fs.writeFile("./duplicates.txt", lines.join("\n"));
};
