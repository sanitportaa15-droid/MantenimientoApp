import fs from "fs";
import { createClient } from "@supabase/supabase-js";

let url = process.env.VITE_SUPABASE_URL;
let key = process.env.VITE_SUPABASE_ANON_KEY;

if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
  
  if (urlMatch && urlMatch[1]) url = urlMatch[1].trim().replace(/['"]/g, "");
  if (keyMatch && keyMatch[1]) key = keyMatch[1].trim().replace(/['"]/g, "");
}

const supabase = createClient(url!, key!);

const defaultTypes = [
  { nombre: "Cambio de pezoneras", frecuencia_meses: 4, descripcion: "Cambio periódico de pezoneras" },
  { nombre: "Mangueras de leche", frecuencia_meses: 12, descripcion: "Cambio de mangueras de leche" },
  { nombre: "Mangueras de pulsado", frecuencia_meses: 12, descripcion: "Cambio de mangueras de pulsado" },
  { nombre: "Pulsadores", frecuencia_meses: 6, descripcion: "Mantenimiento de pulsadores" },
  { nombre: "Cambio de sogas", frecuencia_meses: 4, descripcion: "Cambio de sogas de retiro" },
  { nombre: "Cambio de diafragma de los brazos", frecuencia_meses: 12, descripcion: "Mantenimiento de brazos" },
  { nombre: "Cambio de bujes", frecuencia_meses: 12, descripcion: "Cambio de bujes generales" },
  { nombre: "Sensor de leche", frecuencia_meses: 6, descripcion: "Limpieza y calibración de sensores" },
  { nombre: "Bomba de vacío", frecuencia_meses: 12, descripcion: "Mantenimiento preventivo de bomba" },
  { nombre: "Bomba centrífuga de leche", frecuencia_meses: 6, descripcion: "Revisión de sellos y motor" },
  { nombre: "Bomba diafragma de leche", frecuencia_meses: 4, descripcion: "Cambio de diafragmas" },
  { nombre: "Kit de colector de leche", frecuencia_meses: 12, descripcion: "Mantenimiento de colectores" }
];

async function run() {
  console.log("=== SEMBRANDO TIPOS DE MANTENIMIENTO ===");
  const { data: existing } = await supabase.from("tipos_mantenimiento").select("nombre");
  console.log(`Existentes antes de sembrar: ${existing?.length || 0}`);
  
  if (!existing || existing.length === 0) {
    const { error } = await supabase.from("tipos_mantenimiento").insert(defaultTypes);
    if (error) {
      console.error("Error al insertar tipos_mantenimiento:", error);
    } else {
      console.log("Insertados correctamente todos los tipos de mantenimiento.");
    }
  } else {
    console.log("Ya existen registros de tipos_mantenimiento. No se requiere siembra.");
  }
}

run();
