import { Worker } from "bullmq";
import { ApiVersion } from "@shopify/shopify-api";
import shopify from "./lib/shopify.js";
import transporter from "./lib/mail.js";
import db from "./lib/prisma.js";
import redis from "./lib/redis.js";

const worker = new Worker(
    "inventory-alerts",
    async (job) => {

        const { shop, alertProductId } = job.data;

        const session = await db.session.findFirst({ where: { shop } });
        if (!session) throw new Error("Session not found");

        const product = await db.alertproduct.findUnique({ where: { id: alertProductId } });
        if (!product) throw new Error("Product not found");

        const emailtemplate = await db.emailtemplate.findFirst({ where: { shop } });
        if (!emailtemplate) throw new Error("Template not found");

        const client = new shopify.clients.Graphql({
            session,
            apiVersion: ApiVersion.October25
        })

        const response = await client.request(`
            query getProduct($variantId: ID!) {
            	shop {
                    name
                }
                productVariant(id: $variantId) {
                    title
                    sku
                    inventoryQuantity
                    product {
                        title
                    }
                }
                }
            `,
            {
                variables: {
                    variantId: product.variantId,
                },
            });

        const { data: { shop: shopDetails, productVariant } } = response;

        const variables = {
            shop_name: shopDetails?.name,
            product_name: productVariant?.product?.title,
            variant_name: productVariant?.title,
            quantity: productVariant?.inventoryQuantity,
            low_stock_threshold: product.threshold,
            sku: productVariant?.sku,
            inventory_link: "",
        }

        transporter.sendMail({
            from: "Product Stock Alert <no-reply@alihasnain.h3techs@gmail.com>",
            to: "alihasnain.h3techs@gmail.com",
            subject: "Hello from tests",
            text: "This message was sent from a Node.js integration test.",
        }).then((info) => {
            console.log("Message sent: %s", info.messageId);
        }).catch((error) => {
            console.error;
        })

    },
    { connection: redis, concurrency: 50 }
);

worker.on("completed", (job) => {
    console.log(`${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
    console.log(`${job.id} has failed with ${err.message}`);
});
