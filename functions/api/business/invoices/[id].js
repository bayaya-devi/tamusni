import { cleanText, requireBusiness } from "../../../_lib/auth.js";

const ascii=(value)=>String(value??"").normalize("NFKD").replace(/[^\x20-\x7E]/g,"").replace(/[()\\]/g,"\\$&");
function pdf(lines){
  const stream=`BT /F1 12 Tf 52 790 Td 18 TL ${lines.map((line,index)=>`${index?"T* ":""}(${ascii(line)}) Tj`).join(" ")} ET`;
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let output="%PDF-1.4\n",offsets=[0];objects.forEach((object,index)=>{offsets.push(output.length);output+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=output.length;output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map((offset)=>String(offset).padStart(10,"0")+" 00000 n ").join("\n")}\ntrailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export async function onRequestGet(context){
  const session=await requireBusiness(context);if(!session)return new Response("Forbidden",{status:403});
  const id=cleanText(context.params.id,100);const invoice=await context.env.DB.prepare("SELECT i.*,bp.legal_name,bp.trading_name,bp.professional_email,c.title FROM business_invoices i JOIN business_profiles bp ON bp.user_id=i.business_user_id JOIN business_campaigns c ON c.id=i.campaign_id WHERE i.id=? AND i.business_user_id=?").bind(id,session.sub).first();
  if(!invoice)return new Response("Not found",{status:404});
  const amount=new Intl.NumberFormat("fr-FR",{style:"currency",currency:invoice.currency}).format(Number(invoice.amount_cents)/100);
  const body=pdf(["TAMUSNI BUSINESS — FACTURE",`Numero : ${invoice.invoice_number}`,`Date : ${invoice.issued_at.slice(0,10)}`,"",`Client : ${invoice.legal_name} (${invoice.trading_name})`,`E-mail : ${invoice.professional_email}`,"",`Campagne : ${invoice.title}`,`Montant : ${amount}`,`Statut : ${invoice.status}`,"","A&B TECHNOLOGIES — TAMUSNI"]);
  return new Response(body,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${ascii(invoice.invoice_number)}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
