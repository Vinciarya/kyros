import { asText } from "@prismicio/client";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/prismicio";

// Use a currently supported Stripe API version for reliability.
// "2025-08-27.basil" is not a standard Stripe version format and may cause issues.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Always use a specific, supported date version (e.g., the current recommended one). The version must match the one defined in apiVersion.ts
  apiVersion: "2025-08-27.basil", 
});

// Define the type for the context argument, including the dynamic parameter
interface RouteContext {
  params: {
    uid: string;
  };
}

// The function signature is correctly defined for Next.js App Router dynamic routes.
export async function POST(
  request: NextRequest,
  { params }: RouteContext
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

    // Asserting types for safety, though they should be handled by Prismic types.
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
            unit_amount: price * 100, // Stripe expects smallest unit (pennies/cents/etc.)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Ensure you are using HTTPS for production environments.
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