import { Worker } from "bullmq";
import { ApiVersion } from "@shopify/shopify-api";
import shopify from "./lib/shopify.js";
import transporter from "./lib/mail.js";
import db from "./lib/prisma.js";
import redis from "./lib/redis.js";
import renderTemplate from "./lib/templateRenderer.js";

let status = "FAILED";

const worker = new Worker(
    "inventory-alerts",
    async (job) => {

        const { shop, id, variantId, threshold, notificationEmail } = job.data;

        const session = await db.session.findFirst({ where: { shop } });
        if (!session) throw new Error("Session not found");

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
                    legacyResourceId
                    product {
                        title
                        legacyResourceId
                    }
                }
                }
            `,
            {
                variables: {
                    variantId: variantId,
                },
            });

        const { data: { shop: shopDetails, productVariant } } = response;

        const variables = {
            shop_name: shopDetails?.name,
            product_name: productVariant?.product?.title,
            variant_name: productVariant?.title,
            quantity: productVariant?.inventoryQuantity,
            low_stock_threshold: threshold,
            sku: productVariant?.sku,
            inventory_link: `https://${shop}/admin/products/${productVariant?.product?.legacyResourceId}/variants/${productVariant?.legacyResourceId}`,
        }

        const subject = renderTemplate(
            emailtemplate.subject,
            variables
        );

        const body = renderTemplate(
            emailtemplate.body,
            variables
        );

        try {
            await transporter.sendMail({
                from: "Product Stock Alert <no-reply@alihasnain.h3techs@gmail.com>",
                to: notificationEmail,
                subject: subject,
                text: body,
            })

            status = "SUCCESS";
        } catch (error) {
            console.error("Error sending email: ", error);
        } finally {
            await db.emaillog.create({
                data: {
                    shop,
                    alertProductId: id,
                    recipientEmail: notificationEmail,
                    stockLevel: productVariant?.inventoryQuantity,
                    status
                }
            });
        }
    },
    { connection: redis, concurrency: 50 }
);

worker.on("completed", (job) => {
    console.log(`${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
    console.log(`${job.id} has failed with ${err.message}`);
});
