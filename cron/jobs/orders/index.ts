import { CronJob } from "cron";
import { erp } from "../../../dataSources/erp/index.js";
import prisma from "../../../db/index.js";
import { CreateOrderInput } from "../../../dataSources/erp/types.js";
import { writeFile } from "fs/promises";
import { writeStdOut } from "../../../utils/writeStdOut.js";
import { tiendaNube } from "../../../dataSources/tiendaNube/index.js";
import { sendEmail } from "../../../mail/index.js";
import { saveLogs } from "../../../log/index.js";
import { Prisma } from "@prisma/client";

const dayInMs = 24 * 60 * 60 * 1000;

const job = async () => {
  console.log("Starting orders job");

  const logs: Prisma.LogCreateManyInput[] = [];

  const syncedOrders = await prisma.order.findMany({
    where: {
      AND: [
        {
          syncAt: {
            not: null,
          },
          createdAt: {
            gte: new Date(new Date().getTime() - dayInMs * 12),
          },
        },
      ],
    },
  });

  const newOrders = await tiendaNube.getNewOrders();

  const ordersToCreate: (CreateOrderInput & { orderId: number })[] = [];
  for (const newOrder of newOrders) {
    if (syncedOrders.some((o) => o.orderId === newOrder.id)) continue;

    const products = await Promise.all(
      newOrder.products
        .filter((p) => p.sku)
        .map(async (product) => {
          if (!product.sku)
            throw new Error(`Product ${product.product_id} has no SKU`);
          const erpProduct = await erp.getOneProduct(product.sku);
          if (!erpProduct) {
            throw new Error(`Product ${product.sku} not found in ERP`);
          }

          return {
            productIdInterData: erpProduct.prd_codigo,
            quantity: product.quantity,
            price: product.price,
            sku: product.sku,
          };
        })
    ).catch(async (error) => {
      await sendEmail(
        `Error al sincronizar orden ${newOrder.number}: ${error.message}`
      );
      return [];
    });

    if (products.length === 0) continue;

    const createdAtDate = new Date(newOrder.created_at);

    const parsedDiscount = parseFloat(newOrder.discount || "0");

    ordersToCreate.push({
      fecha_emision: `${createdAtDate.getFullYear()}-${(
        createdAtDate.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${createdAtDate
        .getDate()
        .toString()
        .padStart(2, "0")}`,
      cliente_nombre: newOrder.customer.name || newOrder.contact_name,
      cliente_doc_tipo: newOrder.customer.identification.length === 11 ? 6 : 3,
      cliente_nro_doc: parseInt(
        newOrder.customer.identification.replace("-", "").replace(".", "")
      ),
      cliente_domicilio: `${newOrder.billing_address} ${
        newOrder.billing_number
      } ${newOrder.billing_floor || ""}, ${newOrder.billing_locality || ""}, ${
        newOrder.billing_city
      }, ${newOrder.billing_province}, ${newOrder.billing_country}`,
      cliente_codigo_postal: newOrder.billing_zipcode,
      cliente_email: newOrder.contact_email,
      cliente_telefono: newOrder.contact_phone,
      lugar_de_entrega: `${newOrder.shipping_address.address || ""} ${
        newOrder.shipping_address.number || ""
      } ${newOrder.shipping_address.floor || ""}, ${
        newOrder.shipping_address.locality || ""
      }, ${newOrder.shipping_address.city}, ${
        newOrder.shipping_address.province
      }, ${newOrder.shipping_address.country}`,
      forma_de_envio: newOrder.shipping_option || "",
      forma_de_pago: newOrder.gateway_name || "",
      observaciones: `Forma de envío: ${
        newOrder.shipping_option || ""
      }, Costo: ${newOrder.shipping_cost_customer || ""}\nNumero de orden: ${
        newOrder.number
      }`,
      pk_id: newOrder.number,
      productos: products
        .map((product): CreateOrderInput["productos"][number] => ({
          producto_codigo: product.productIdInterData,
          producto_cantidad: product.quantity,
          producto_cod_alternativo: product.sku,
          producto_precio_unitario: parseFloat(product.price),
        }))
        .concat(
          parsedDiscount > 0
            ? [
                {
                  producto_codigo: 100000,
                  producto_precio_unitario: parsedDiscount,
                  producto_cantidad: 1.0,
                },
              ]
            : []
        ),
      orderId: newOrder.id,
    });
  }

  for (const order of ordersToCreate) {
    const { orderId, ...rest } = order;
    await erp.createOrder(rest, {
      onSuccess: async () => {
        console.log("Order created!!!!");
        logs.push({
          message: `Orden ${order.pk_id} sincronizada correctamente`,
          type: "success",
          data: JSON.stringify(order),
        });
        await prisma.order.create({
          data: {
            orderId: orderId,
            syncAt: new Date(),
            number: order.pk_id,
          },
        });
      },
      onError: async (_, error) => {
        await sendEmail(`Error al sincronizar orden ${order.pk_id}: ${error}`);
      },
    });
  }

  if (logs.length) {
    await saveLogs(logs);
  }
  console.log("Orders job finished:" + ordersToCreate.length);
};

export default {
  name: "orders",
  cronJob: new CronJob("*/5 * * * *", job),
  run: job,
};
