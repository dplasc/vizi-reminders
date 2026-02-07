import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE_NAME = "vizi_reminders_session";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await params;
  const session = _request.cookies.get(SESSION_COOKIE_NAME);
  const userId = session?.value;

  if (!userId?.trim()) {
    return NextResponse.json(
      { error: "Niste prijavljeni." },
      { status: 401 }
    );
  }

  if (!appointmentId?.trim()) {
    return NextResponse.json(
      { error: "Termin nije pronađen." },
      { status: 404 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("owner_id", userId)
    .select("id");

  if (error) {
    console.error("[api/appointments/[id]] Delete failed:", error.message);
    return NextResponse.json(
      { error: "Brisanje termina nije uspjelo. Pokušajte ponovno." },
      { status: 500 }
    );
  }

  if (!data?.length) {
    return NextResponse.json(
      { error: "Termin nije pronađen ili nemate dozvolu za brisanje." },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
