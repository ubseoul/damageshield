import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "princeubearchives@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const body = await req.json();
    const {
      detailerName,
      detailerEmail,
      clientName,
      clientEmail,
      vehicleInfo,
      damageItems,
      signatureDataUrl,
      timestamp,
      reportId,
    } = body;

    // Build HTML for PDF
    const damageRows = damageItems
      .map(
        (item: any, i: number) => `
        <tr style="border-bottom:1px solid #2a2a2a;">
          <td style="padding:12px 8px;color:#ccc;font-size:13px;">${i + 1}</td>
          <td style="padding:12px 8px;color:#e8e8e8;font-weight:600;">${item.type}</td>
          <td style="padding:12px 8px;color:#ccc;">${item.location}</td>
          <td style="padding:12px 8px;color:#aaa;font-size:12px;">${item.notes || "—"}</td>
        </tr>
        ${
          item.photoDataUrl
            ? `<tr><td colspan="4" style="padding:8px;"><img src="${item.photoDataUrl}" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid #333;" /></td></tr>`
            : ""
        }
      `
      )
      .join("");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f0f; color: #e8e8e8; font-family: 'Georgia', serif; }
    .page { max-width: 780px; margin: 0 auto; padding: 48px 40px; }
    .header { border-bottom: 2px solid #c8892a; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 22px; font-weight: 700; color: #c8892a; letter-spacing: 2px; text-transform: uppercase; }
    .brand-sub { font-size: 11px; color: #666; letter-spacing: 1px; margin-top: 4px; }
    .report-id { font-size: 11px; color: #555; text-align: right; }
    .report-id strong { color: #888; display: block; font-size: 13px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #c8892a; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item label { font-size: 10px; color: #666; letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #e8e8e8; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #666; padding: 8px; border-bottom: 1px solid #333; }
    .contract-text { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; font-size: 12px; line-height: 1.7; color: #aaa; }
    .contract-text strong { color: #e8e8e8; }
    .sig-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; }
    .sig-box { text-align: center; }
    .sig-box img { max-width: 220px; max-height: 80px; border-bottom: 1px solid #444; display: block; margin-bottom: 8px; }
    .sig-box span { font-size: 10px; color: #555; letter-spacing: 1px; text-transform: uppercase; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #2a2a2a; font-size: 10px; color: #444; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">⚡ Damage Shield</div>
      <div class="brand-sub">Pre-Service Vehicle Condition Report</div>
    </div>
    <div class="report-id">
      <strong>Report #${reportId}</strong>
      ${new Date(timestamp).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}<br/>
      ${new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Parties Involved</div>
    <div class="info-grid">
      <div class="info-item"><label>Service Provider</label><span>${detailerName}</span></div>
      <div class="info-item"><label>Client Name</label><span>${clientName}</span></div>
      <div class="info-item"><label>Provider Email</label><span>${detailerEmail}</span></div>
      <div class="info-item"><label>Client Email</label><span>${clientEmail}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Vehicle Information</div>
    <div class="info-grid">
      <div class="info-item"><label>Make & Model</label><span>${vehicleInfo.makeModel}</span></div>
      <div class="info-item"><label>Year</label><span>${vehicleInfo.year}</span></div>
      <div class="info-item"><label>Colour</label><span>${vehicleInfo.colour}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Pre-Existing Damage Documentation</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Damage Type</th>
          <th>Location</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${damageRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Agreement & Disclaimer</div>
    <div class="contract-text">
      <p>This <strong>Pre-Service Vehicle Condition Report</strong> ("Agreement") is entered into on the date and time stated above between the Service Provider and the Client identified herein.</p>
      <br/>
      <p><strong>1. Acknowledgement of Pre-Existing Damage.</strong> The Client hereby acknowledges and confirms that all damage items documented in this report, including any accompanying photographs, represent pre-existing conditions present on the vehicle prior to the commencement of any detailing or automotive services by the Service Provider.</p>
      <br/>
      <p><strong>2. Release of Liability.</strong> By signing this document, the Client agrees that the Service Provider shall not be held responsible or liable for any of the pre-existing damage conditions documented herein, nor for any damage that may be attributed to pre-existing structural weaknesses, paint defects, or conditions noted above.</p>
      <br/>
      <p><strong>3. Accuracy of Documentation.</strong> Both parties confirm that the photographs and descriptions contained in this report accurately represent the vehicle's condition at the time of inspection, immediately prior to service commencement.</p>
      <br/>
      <p><strong>4. Platform Disclaimer.</strong> This document was generated by Damage Shield, a documentation tool. Damage Shield, its creators, and affiliates are not legal advisors and provide no warranty that this document constitutes legally binding protection in any jurisdiction. Users are advised to seek independent legal counsel for matters requiring legal certainty. The platform bears no liability for outcomes arising from the use of this document.</p>
      <br/>
      <p><strong>5. Digital Signature.</strong> The Client's digital signature below constitutes their informed agreement to all terms stated in this document and their confirmation of the accuracy of the pre-existing damage documentation.</p>
    </div>
  </div>

  <div class="sig-section">
    <div class="sig-box">
      <img src="${signatureDataUrl}" alt="Client Signature" />
      <span>Client Signature — ${clientName}</span>
    </div>
    <div class="sig-box" style="text-align:right;">
      <div style="font-size:11px;color:#666;margin-bottom:8px;">Digitally timestamped</div>
      <div style="font-size:13px;color:#888;">${new Date(timestamp).toISOString()}</div>
    </div>
  </div>

  <div class="footer">
    This document was generated by Damage Shield and emailed simultaneously to both parties at the time of signing.<br/>
    Report ID: ${reportId} · Generated: ${new Date(timestamp).toISOString()}<br/><br/>
    <em>Damage Shield is a documentation tool only. This report does not constitute legal advice.</em>
  </div>
</div>
</body>
</html>`;

    // Email body for detailer
    const detailerEmailBody = `
<div style="font-family:Georgia,serif;background:#0f0f0f;color:#e8e8e8;padding:40px;max-width:600px;margin:0 auto;">
  <div style="border-bottom:2px solid #c8892a;padding-bottom:20px;margin-bottom:28px;">
    <div style="font-size:20px;font-weight:700;color:#c8892a;letter-spacing:2px;">⚡ DAMAGE SHIELD</div>
    <div style="font-size:11px;color:#666;margin-top:4px;">Report Delivered Successfully</div>
  </div>
  <p style="color:#aaa;font-size:14px;line-height:1.7;">Your pre-service damage report for <strong style="color:#e8e8e8;">${clientName}</strong> has been sent and logged.</p>
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px;margin:24px 0;">
    <div style="font-size:10px;color:#c8892a;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Report Summary</div>
    <div style="font-size:13px;color:#ccc;line-height:2;">
      <div>Client: <strong style="color:#e8e8e8;">${clientName}</strong></div>
      <div>Vehicle: <strong style="color:#e8e8e8;">${vehicleInfo.year} ${vehicleInfo.makeModel} (${vehicleInfo.colour})</strong></div>
      <div>Damage items logged: <strong style="color:#e8e8e8;">${damageItems.length}</strong></div>
      <div>Report ID: <strong style="color:#e8e8e8;">#${reportId}</strong></div>
    </div>
  </div>
  <p style="color:#555;font-size:12px;line-height:1.6;">The full signed PDF is attached to this email. Both you and your client received identical copies simultaneously at ${new Date(timestamp).toLocaleTimeString()}.</p>
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #2a2a2a;font-size:10px;color:#444;">
    Damage Shield · Documentation for Detailing Professionals
  </div>
</div>`;

    // Email body for client
    const clientEmailBody = `
<div style="font-family:Georgia,serif;background:#0f0f0f;color:#e8e8e8;padding:40px;max-width:600px;margin:0 auto;">
  <div style="border-bottom:2px solid #c8892a;padding-bottom:20px;margin-bottom:28px;">
    <div style="font-size:20px;font-weight:700;color:#c8892a;letter-spacing:2px;">⚡ DAMAGE SHIELD</div>
    <div style="font-size:11px;color:#666;margin-top:4px;">Your Vehicle Condition Report</div>
  </div>
  <p style="color:#aaa;font-size:14px;line-height:1.7;">Hi <strong style="color:#e8e8e8;">${clientName}</strong>,</p>
  <p style="color:#aaa;font-size:14px;line-height:1.7;margin-top:12px;">You recently signed a pre-service damage report with <strong style="color:#e8e8e8;">${detailerName}</strong>. This email contains your copy of that signed document for your records.</p>
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px;margin:24px 0;">
    <div style="font-size:10px;color:#c8892a;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">What This Document Is</div>
    <p style="font-size:13px;color:#aaa;line-height:1.7;">This report documents the existing condition of your vehicle <strong style="color:#e8e8e8;">(${vehicleInfo.year} ${vehicleInfo.makeModel})</strong> prior to any detailing work. It protects both you and your service provider by creating an accurate record of pre-existing damage.</p>
  </div>
  <p style="color:#555;font-size:12px;line-height:1.6;">Please keep this email and the attached PDF for your records. Report ID: #${reportId}</p>
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #2a2a2a;font-size:10px;color:#444;">
    Damage Shield · Documentation for Detailing Professionals
  </div>
</div>`;

    // Send to detailer
    const detailerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Damage Shield <${FROM_EMAIL}>`,
        to: [detailerEmail],
        subject: `✓ Report Sent — ${clientName} · ${vehicleInfo.year} ${vehicleInfo.makeModel}`,
        html: detailerEmailBody,
        attachments: [
          {
            filename: `damage-report-${reportId}.html`,
            content: Buffer.from(htmlContent).toString("base64"),
          },
        ],
      }),
    });

    // Send to client
    const clientRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Damage Shield <${FROM_EMAIL}>`,
        to: [clientEmail],
        subject: `Your Vehicle Condition Report — ${vehicleInfo.year} ${vehicleInfo.makeModel}`,
        html: clientEmailBody,
        attachments: [
          {
            filename: `damage-report-${reportId}.html`,
            content: Buffer.from(htmlContent).toString("base64"),
          },
        ],
      }),
    });

    if (!detailerRes.ok || !clientRes.ok) {
      const err = await detailerRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ success: true, reportId }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
