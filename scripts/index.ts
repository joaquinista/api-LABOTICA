import "dotenv/config";
import prompts from "prompts";
import { setupProducts } from "./setup_products.js";
import { fixWeights } from "./fix_weights.js";
import { findErpDuplicates } from "./find_erp_duplicates.js";
import { fixImages } from "./fix_images.js";
import { findErpDisabledProducts } from "./find_erp_disabled_products.js";
import { findTnShouldEnableProducts } from "./find_tn_should_enable_products.js";
import { deleteErpDisabledProducts } from "./delete_erp_disabled_products.js";
import { updateProductInterdataCodes } from "./updateProductInterdataCodes.js";
import { refreshProducts } from "./refresh_products.js";

const scriptName = await prompts({
  type: "select",
  name: "scriptName",
  message: "Select a script to run",
  choices: [
    { title: "setup_products", value: "setup_products" },
    { title: "fix_weights", value: "fix_weights" },
    { title: "find_erp_duplicates", value: "find_erp_duplicates" },
    { title: "fix_images", value: "fix_images" },
    {
      title: "find_erp_disabled_products",
      value: "find_erp_disabled_products",
    },
    {
      title: "find_tn_should_enable_products",
      value: "find_tn_should_enable_products",
    },
    {
      title: "delete_erp_disabled_products",
      value: "delete_erp_disabled_products",
    },
    {
      title: "update_product_interdata_codes",
      value: "update_product_interdata_codes",
    },
    { title: "refresh_products", value: "refresh_products" },
  ],
}).then((res) => {
  if (typeof res.scriptName === "string") {
    return res.scriptName;
  } else {
    throw new Error("No script selected");
  }
});

switch (scriptName) {
  case "setup_products":
    await setupProducts();
    break;
  case "fix_weights":
    await fixWeights();
    break;
  case "find_erp_duplicates":
    await findErpDuplicates();
    break;
  case "fix_images":
    await fixImages();
    break;
  case "find_erp_disabled_products":
    await findErpDisabledProducts();
    break;
  case "find_tn_should_enable_products":
    await findTnShouldEnableProducts();
    break;
  case "delete_erp_disabled_products":
    await deleteErpDisabledProducts();
    break;
  case "update_product_interdata_codes":
    await updateProductInterdataCodes();
    break;
  case "refresh_products":
    await refreshProducts();
    break;
  default:
    throw new Error("No script selected");
}

console.log("Script complete!");
