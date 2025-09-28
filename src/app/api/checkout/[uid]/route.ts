import { asText } from "@prismicio/client";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/prismicio";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

export async function POST(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const { uid } = params;

    if (!uid) {
      return NextResponse.json(
        { error: "Missing Product UID" },
        { status: 400 }
      );
    }

    const prismicClient = createClient();
    const product = await prismicClient.getByUID("product", uid);

    const name = product.data.name as string;
    const price = product.data.price as number;
    const image = product.data.image?.url;
    const description = asText(product.data.description);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name,
              ...(description ? { description } : {}),
              ...(image ? { images: [image] } : {}),
            },
            unit_amount: price * 100, // Stripe expects smallest unit
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${request.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get("origin")}/`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe Session" },
      { status: 500 }
    );
  }
}
