import { json, readBody, requireContributor, sameOrigin } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({error:"Origine refusée."},403);
  if (!await requireContributor(context)) return json({error:"Accès réservé aux contributeurs."},403);
  try {
    const body = await readBody(context.request,2_100_000);
    const data = String(body.data || "");
    const match = data.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || data.length > 1_900_000) return json({error:"Image refusée. Importez un JPEG de moins de 1,4 Mo."},400);
    const binary = atob(match[1]);
    if (binary.length < 4 || binary.length > 1_400_000 || binary.charCodeAt(0)!==0xff || binary.charCodeAt(1)!==0xd8 || binary.charCodeAt(2)!==0xff) return json({error:"Le fichier n’est pas une image JPEG valide ou dépasse 1,4 Mo."},400);
    const key = `${crypto.randomUUID()}.jpg`;
    await context.env.DB.prepare("INSERT INTO editorial_media(media_key,content_type,data_base64,alt_text,disclosure,created_at) VALUES(?,?,?,?,?,?)").bind(key,"image/jpeg",match[1],"Image de couverture proposée par un contributeur","Téléversement contributeur",new Date().toISOString()).run();
    return json({ok:true,url:`/media/${key}`},201);
  } catch (error) {
    return json({error:error?.message==="PAYLOAD_TOO_LARGE"?"Image trop volumineuse.":"Import de l’image impossible."},400);
  }
}
