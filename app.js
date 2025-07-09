const SUPABASE_URL = "https://gjvdghwkueqrametwunb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdmRnaHdrdWVxcmFtZXR3dW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5Nzg0MTcsImV4cCI6MjA2NzU1NDQxN30.dg-8xLC0d1JwjOKIPL2sMcuecV30OdC-PeFGsnrhEM0";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let idEditando = null;
let chartStatus = null;
let chartCompra = null;

let paginaAtual = 1;
const produtosPorPagina = 10;

async function carregarProdutos() {
  const { data, error } = await supabaseClient.from("Produtos").select("*").order("id", { ascending: true });

  const filtro = document.getElementById("filtro-categoria").value;
  const filtroStatus = document.getElementById("filtro-status")?.value || "";
  const tbody = document.getElementById("produtos-lista");
  tbody.innerHTML = "";

  const categorias = new Set();
  const contagemStatus = { ok: 0, comprar: 0, cheio: 0 };
  const produtosParaComprar = {};


  // Aplica filtros
  const produtosFiltrados = data.filter(produto => {
    const status = calcularStatus(produto);
    if (filtro && produto.categoria !== filtro) return false;
    if (
      (filtroStatus === "ok" && status !== "Estoque OK") ||
      (filtroStatus === "comprar" && !status.startsWith("Comprar")) ||
      (filtroStatus === "cheio" && status !== "Estoque cheio")
    ) return false;
    return true;
  });

  const totalPaginas = Math.ceil(produtosFiltrados.length / produtosPorPagina);
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas || 1;

  const inicio = (paginaAtual - 1) * produtosPorPagina;
  const fim = inicio + produtosPorPagina;

  const produtosPagina = produtosFiltrados.slice(inicio, fim);

  produtosPagina.forEach((produto) => {
    const status = calcularStatus(produto);

    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${produto.codigo || ""}</td>
      <td>${produto.nome}</td>
      <td>${produto.qtd_atual}</td>
      <td style="color: ${status.startsWith("Comprar") ? 'red' : 'inherit'}">${status}</td>
      <td>
        <input type="number" min="0" class="form-control form-control-sm" id="input-${produto.id}" placeholder="Nova qtd" />
        <button class="btn btn-sm btn-success mt-1" onclick="atualizarQtd(${produto.id})">Atualizar</button>
      </td>
      <td>
        <button class="btn btn-sm btn-warning mb-1" onclick="editarProduto(${produto.id})">Editar</button><br/>
        <button class="btn btn-sm btn-danger" onclick="excluirProduto(${produto.id})">Excluir</button>
      </td>
      <td>${new Date(produto.atualizado_em).toLocaleString("pt-BR")}</td>
    `;
    tbody.appendChild(linha);

    categorias.add(produto.categoria);

    if (status === "Estoque OK") contagemStatus.ok++;
    else if (status.startsWith("Comprar")) {
      contagemStatus.comprar++;
      const qtd = produto.qtd_maxima - produto.qtd_atual;
      produtosParaComprar[produto.nome] = qtd;
    } else if (status === "Estoque cheio") contagemStatus.cheio++;
    
  });

  renderizarTabelaCompras(produtosParaComprar);

  preencherFiltroCategorias(categorias);
  renderizarPaginacao(totalPaginas);
  renderizarGraficoStatus(contagemStatus);
  renderizarGraficoCompra(produtosParaComprar);

  if (contagemStatus.comprar > 0) {
  const beep = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  beep.play();
}
}

function renderizarPaginacao(totalPaginas) {
  let container = document.getElementById("paginacao");
  if (!container) {
    container = document.createElement("div");
    container.id = "paginacao";
    container.className = "mt-3 text-center";
    document.querySelector(".container").appendChild(container);
  }

  container.innerHTML = "";
  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button");
    btn.className = `btn btn-sm me-1 ${i === paginaAtual ? "btn-warning" : "btn-outline-light"}`;
    btn.textContent = `Página ${i}`;
    btn.onclick = () => {
      paginaAtual = i;
      carregarProdutos();
    };
    container.appendChild(btn);
  }
}

function preencherFiltroCategorias(categorias) {
  const select = document.getElementById("filtro-categoria");
  const valorAtual = select.value;

  select.innerHTML = '<option value="">Todas</option>';
  Array.from(categorias).sort().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    if (c === valorAtual) opt.selected = true;
    select.appendChild(opt);
  });
}

function calcularStatus(prod) {
  if (prod.qtd_atual < prod.qtd_minima) {
  return `Comprar ${prod.qtd_maxima - prod.qtd_atual}`;
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

  await supabaseClient.from("Produtos").update({ qtd_atual: novaQtd, atualizado_em: new Date().toISOString() }).eq("id", id);
  carregarProdutos();
}

document.getElementById("form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();

  const codigo = document.getElementById("codigo").value;
  const nome = document.getElementById("nome").value;
  const qtd_minima = parseInt(document.getElementById("qtd_minima").value);
  const qtd_maxima = parseInt(document.getElementById("qtd_maxima").value);
  const qtd_atual = parseInt(document.getElementById("qtd_atual").value);
  const categoria = document.getElementById("categoria").value;

  if (idEditando) {
    await supabaseClient.from("Produtos").update({
      codigo, nome, qtd_minima, qtd_maxima, qtd_atual, categoria, atualizado_em: new Date().toISOString()
    }).eq("id", idEditando);
    idEditando = null;
  } else {
    await supabaseClient.from("Produtos").insert([{ codigo, nome, qtd_minima, qtd_maxima, qtd_atual, categoria, atualizado_em: new Date().toISOString() }]);
  }

  e.target.reset();
  carregarProdutos();
});

async function editarProduto(id) {
  const { data } = await supabaseClient.from("Produtos").select("*").eq("id", id).single();

  document.getElementById("codigo").value = data.codigo;
  document.getElementById("nome").value = data.nome;
  document.getElementById("qtd_minima").value = data.qtd_minima;
  document.getElementById("qtd_maxima").value = data.qtd_maxima;
  document.getElementById("qtd_atual").value = data.qtd_atual;
  document.getElementById("categoria").value = data.categoria;

  idEditando = id;
}

async function excluirProduto(id) {
  if (confirm("Tem certeza que deseja excluir este produto?")) {
    const { error } = await supabaseClient.from("Produtos").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir:", error.message);
      alert("Erro ao excluir: " + error.message);
    } else {
      alert("Produto excluído com sucesso!");
      carregarProdutos();
    }
  }
}

function exportarExcel() {
  const tabela = document.querySelector("table");
  const wb = XLSX.utils.table_to_book(tabela, { sheet: "Estoque" });
  XLSX.writeFile(wb, "estoque.xlsx");
}

function renderizarGraficoStatus(dados) {
  const ctx = document.getElementById("graficoStatus").getContext("2d");
  if (chartStatus) chartStatus.destroy();

  chartStatus = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Estoque OK", "Comprar", "Estoque cheio"],
      datasets: [{
        data: [dados.ok, dados.comprar, dados.cheio],
        backgroundColor: [
          "rgba(75, 192, 192, 0.7)",
          "rgba(255, 99, 132, 0.7)",
          "rgba(255, 206, 86, 0.7)"
        ]
      }]
    },
    options: {
      responsive: true
    }
  });
}

function renderizarGraficoCompra(dados) {
  const ctx = document.getElementById("graficoCompra").getContext("2d");
  if (chartCompra) chartCompra.destroy();

  chartCompra = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(dados),
      datasets: [{
        label: "Qtd Necessária",
        data: Object.values(dados),
        backgroundColor: "rgba(255, 99, 132, 0.7)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderizarTabelaCompras(dados) {
  const tbody = document.getElementById("tabela-compras");
  if (!tbody) return;

  tbody.innerHTML = "";

  const nomes = Object.keys(dados);
  if (nomes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center">Nenhum produto com necessidade de compra.</td></tr>`;
    return;
  }

  nomes.forEach(nome => {
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${nome}</td>
      <td>${dados[nome]}</td>
    `;
    tbody.appendChild(linha);
  });
}

window.addEventListener("load", carregarProdutos);
