const SUPABASE_URL = "https://gjvdghwkueqrametwunb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdmRnaHdrdWVxcmFtZXR3dW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5Nzg0MTcsImV4cCI6MjA2NzU1NDQxN30.dg-8xLC0d1JwjOKIPL2sMcuecV30OdC-PeFGsnrhEM0";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function carregarProdutos() {
  const { data, error } = await supabaseClient.from("Produtos").select("*").order("id", { ascending: true });
  const tbody = document.getElementById("produtos-lista");
  tbody.innerHTML = "";

  data.forEach((produto) => {
    const status = calcularStatus(produto);
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${produto.nome}</td>
      <td>${produto.qtd_atual}</td>
      <td>${status}</td>
      <td>
        <input type="number" min="0" class="form-control form-control-sm" id="input-${produto.id}" placeholder="Nova qtd" />
        <button class="btn btn-sm btn-success mt-1" onclick="atualizarQtd(${produto.id})">Atualizar</button>
      </td>
    `;
    tbody.appendChild(linha);
  });
}

function calcularStatus(prod) {
  if (prod.qtd_atual < prod.qtd_minima) {
    return `Comprar ${prod.qtd_minima - prod.qtd_atual}`;
  }
  if (prod.qtd_atual > prod.qtd_maxima) {
    return "Estoque cheio";
  }
  return "Estoque OK";
}

async function atualizarQtd(id) {
  const input = document.getElementById(`input-${id}`);
  const novaQtd = parseInt(input.value);
  if (isNaN(novaQtd)) return alert("Digite uma quantidade válida");

  await supabaseClient.from("Produtos").update({ qtd_atual: novaQtd }).eq("id", id);
  carregarProdutos();
}

document.getElementById("form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome").value;
  const qtd_minima = parseInt(document.getElementById("qtd_minima").value);
  const qtd_maxima = parseInt(document.getElementById("qtd_maxima").value);
  const qtd_atual = parseInt(document.getElementById("qtd_atual").value);

  await supabaseClient.from("Produtos").insert([{ nome, qtd_minima, qtd_maxima, qtd_atual }]);
  e.target.reset();
  carregarProdutos();
});

window.addEventListener("load", carregarProdutos);
