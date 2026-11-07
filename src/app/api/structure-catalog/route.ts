import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { apolloProductsCatalog, ApolloProduct } from "@/data/apolloProducts";
import { getUserSession, unauthorizedResponse, forbiddenResponse } from "@/lib/authGuard";

// Helper: convert DB row (snake_case) to ApolloProduct (camelCase)
function rowToProduct(row: any): ApolloProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    gstRate: Number(row.gst_rate),
    basePrice: Number(row.base_price),
    stock: row.stock,
    description: row.description || "",
  };
}

// GET - List all structure catalog items
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("structure_catalog")
      .select("*")
      .order("name");

    if (error) {
      console.error("Supabase structure_catalog GET error:", error.message);
      // Fallback to hardcoded catalog if DB fails
      return NextResponse.json({ success: true, data: apolloProductsCatalog, fromDefaults: true });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, data: apolloProductsCatalog, fromDefaults: true });
    }

    return NextResponse.json({ success: true, data: data.map(rowToProduct) });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST - Add a new product or perform bulk operations (super_admin only)
export async function POST(request: Request) {
  try {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();
    if (!session.isSuperAdmin) return forbiddenResponse('Only Super Administrators can modify the structure catalog');

    const body = await request.json();
    const supabase = getServerSupabase();

    // Reset action - replace all with defaults
    if (body.action === "reset") {
      // Delete all existing
      await supabase.from("structure_catalog").delete().neq("id", "");
      // Insert defaults
      const rows = apolloProductsCatalog.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        unit: p.unit,
        gst_rate: p.gstRate,
        base_price: p.basePrice,
        stock: p.stock,
        description: p.description || "",
      }));
      const { error } = await supabase.from("structure_catalog").upsert(rows, { onConflict: "id" });
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Reset to default catalog", data: apolloProductsCatalog });
    }

    // Add product
    const { name, sku, category, unit, gstRate, basePrice, stock, description } = body;
    if (!name || !sku) {
      return NextResponse.json({ success: false, message: "Product name and SKU are required" }, { status: 400 });
    }

    const newId = body.id || `custom-${Date.now()}`;
    const row = {
      id: newId,
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category: category || "G.I. Solar Mounting Structure",
      unit: unit || "Pcs",
      gst_rate: Number(gstRate) || 18,
      base_price: Number(basePrice) || 0,
      stock: stock || "In Stock",
      description: description || "",
    };

    const { data, error } = await supabase
      .from("structure_catalog")
      .insert([row])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: rowToProduct(data), message: "Product added successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT - Update an existing product (rate, stock, name, etc. - super_admin only)
export async function PUT(request: Request) {
  try {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();
    if (!session.isSuperAdmin) return forbiddenResponse("Only Super Administrators can modify the structure catalog");

    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Product ID is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Build the update object with snake_case keys
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.sku !== undefined) dbUpdates.sku = updates.sku;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.gstRate !== undefined) dbUpdates.gst_rate = Number(updates.gstRate);
    if (updates.basePrice !== undefined) dbUpdates.base_price = Number(updates.basePrice);
    if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
    if (updates.description !== undefined) dbUpdates.description = updates.description;

    const { data, error } = await supabase
      .from("structure_catalog")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rowToProduct(data), message: "Product updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE - Remove a product from the catalog (super_admin only)
export async function DELETE(request: Request) {
  try {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();
    if (!session.isSuperAdmin) return forbiddenResponse("Only Super Administrators can delete structure catalog items");

    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ success: false, message: "Product ID is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("structure_catalog")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
