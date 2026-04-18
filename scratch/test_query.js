const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vhfjuttwavxuxeceffpa.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZmp1dHR3YXZ4dXhlY2VmZnBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ4OTg3MywiZXhwIjoyMDkyMDY1ODczfQ.Q8OA-hb6-u9UTbHwbC5KsYirS7YvM94DfE9gGJG1lPY';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function test() {
    console.log("Checando tabela de categorias...");
    const { data, error } = await supabase.from('categorias').select('*');
    if (error) {
        console.error("Erro ao acessar categorias:", error.message);
    } else {
        console.log(`Encontradas ${data.length} categorias.`);
        console.table(data);
    }
}

test();
