const SUPABASE_URL = "https://gjvdghwkueqrametwunb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdmRnaHdrdWVxcmFtZXR3dW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5Nzg0MTcsImV4cCI6MjA2NzU1NDQxN30.dg-8xLC0d1JwjOKIPL2sMcuecV30OdC-PeFGsnrhEM0";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let idEditando = null;
let chartStatus = null;
let chartCompra = null;

let paginaAtual = 1;
const produtosPorPagina = 10;

let todosProdutos = []; // declarar fora da função (global)

async function carregarProdutos() {
  const { data, error } = await supabaseClient
  .from("Produtos")
  .select("id, nome, codigo, categoria, qtd_atual, qtd_minima, qtd_maxima, atualizado_em, prioridade_compra")
  .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar produtos:", error.message);
    return;
  }

  todosProdutos = data; // salvando todos os produtos globalmente

  const filtro = document.getElementById("filtro-categoria").value;
  const filtroStatus = document.getElementById("filtro-status")?.value || "";
  const termoBusca = document.getElementById("busca-produto")?.value?.toLowerCase() || "";
  const tbody = document.getElementById("produtos-lista");
  tbody.innerHTML = "";

  const categorias = new Set();
  const contagemStatus = { ok: 0, comprar: 0, cheio: 0 };
  const produtosParaComprar = {};

  const produtosFiltrados = data.filter(produto => {
    const status = calcularStatus(produto);

    if (
      termoBusca &&
      !produto.nome.toLowerCase().includes(termoBusca) &&
      !(produto.codigo || "").toLowerCase().includes(termoBusca)
    ) return false;

    if (filtro && produto.categoria !== filtro) return false;

    if (
      (filtroStatus === "ok" && status !== "ok") ||
      (filtroStatus === "comprar" && !status.startsWith("comprar")) ||
      (filtroStatus === "cheio" && status !== "cheio")
    ) return false;

    return true;
  });

  const totalPaginas = Math.ceil(produtosFiltrados.length / 10);
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas || 1;

  const inicio = (paginaAtual - 1) * 10;
  const fim = inicio + 10;
  // Primeiro: percorre todos os filtrados para atualizar gráficos e compras
produtosFiltrados.forEach(produto => {
  const status = calcularStatus(produto);
  categorias.add(produto.categoria);

  if (status === "ok") contagemStatus.ok++;
  else if (status.startsWith("comprar")) {
    contagemStatus.comprar++;
    const qtd = parseInt(status.split("-")[1]);
    produtosParaComprar[produto.nome] = qtd;
  } else if (status === "cheio") contagemStatus.cheio++;
});

// Depois: apenas exibe os da página atual
const produtosPagina = produtosFiltrados.slice(inicio, fim);

produtosPagina.forEach(produto => {
  const status = calcularStatus(produto);
  const linha = document.createElement("tr");
  linha.innerHTML = `
    <td>${produto.codigo || ""}</td>
    <td>${produto.nome}</td>
    <td>${produto.qtd_atual}</td>
    <td>${renderizarStatusBadge(status)}</td>
    <td>
      <input type="number" min="0" class="form-control form-control-sm" id="input-${produto.id}" placeholder="Nova qtd" />
      <button class="btn btn-sm btn-success mt-1" onclick="atualizarQtd(${produto.id})" title="Atualizar quantidade">
        <i class="bi bi-check-circle"></i>
      </button>
    </td>
    <td>
      <button class="btn btn-sm btn-warning mb-1" onclick="editarProduto(${produto.id})" title="Editar">
        <i class="bi bi-pencil-square"></i>
      </button><br/>
      <button class="btn btn-sm btn-danger" onclick="excluirProduto(${produto.id})" title="Excluir">
        <i class="bi bi-trash"></i>
      </button>
    </td>
    <td>${new Date(produto.atualizado_em).toLocaleString("pt-BR")}</td>
  `;
  tbody.appendChild(linha);
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
  const container = document.getElementById("paginacao");
if (!container) return; // evita erro se a div sumir
container.innerHTML = ""; // limpa paginação antiga

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
    return `comprar-${prod.qtd_maxima - prod.qtd_atual}`;
  }
  if (prod.qtd_atual > prod.qtd_maxima) {
    return "cheio";
  }
  return "ok";
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
  console.log("Tentando editar produto com ID:", id);

  const { data, error } = await supabaseClient
    .from("Produtos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Erro ao buscar produto:", error.message);
    alert("Erro ao carregar o produto para edição.");
    return;
  }

  if (!data) {
    alert("Produto não encontrado.");
    return;
  }

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
  // Cria uma planilha com os produtos carregados (sem depender da tabela visível)
  const dados = todosProdutos.map(prod => {
    const status = calcularStatus(prod);
    return {
      Código: prod.codigo,
      Nome: prod.nome,
      Categoria: prod.categoria,
      "Qtd Mínima": prod.qtd_minima,
      "Qtd Máxima": prod.qtd_maxima,
      "Qtd Atual": prod.qtd_atual,
      Status: status.startsWith("comprar") ? "Comprar" : status === "cheio" ? "Estoque cheio" : "Estoque OK",
      "Última Atualização": new Date(prod.atualizado_em).toLocaleString("pt-BR")
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");

  XLSX.writeFile(workbook, "estoque-completo.xlsx");
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

  const nomes = Object.keys(dados).sort((a, b) => a.localeCompare(b));
  if (nomes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Nenhum produto com necessidade de compra.</td></tr>`;
    return;
  }

  nomes.forEach(nome => {
    const produto = todosProdutos.find(p => p.nome === nome);
    const prioridade = produto?.prioridade_compra;

    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>
        <input type="checkbox" class="form-check-input prioridade-checkbox" 
          title="Marcar como prioridade"
          ${prioridade ? "checked" : ""}
          onchange="atualizarPrioridadeCompra(${produto?.id}, this.checked)">
      </td>
      <td>${produto?.codigo || ""}</td>
      <td>${nome}</td>
      <td>${dados[nome]}</td>
    `;
    tbody.appendChild(linha);
  });
}

async function exportarComprasPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const tbody = document.getElementById("tabela-compras");
  const linhas = tbody.querySelectorAll("tr");

  if (!linhas.length) {
    alert("Nenhum item para exportar.");
    return;
  }

  doc.setFontSize(14);
  doc.text("Lista de Compras", 14, 20);

  let y = 30;
  doc.setFontSize(11);
  doc.text("Prioridade", 14, y);
  doc.text("Código", 40, y);
  doc.text("Produto", 80, y);
  doc.text("Quantidade", 160, y);
  y += 8;

  linhas.forEach((tr, index) => {
    const cols = tr.querySelectorAll("td");
    if (cols.length === 4) {
      const prioridade = cols[0].querySelector("input")?.checked ? "Sim" : "Não";
      const codigo = cols[1].textContent.trim();
      const nome = cols[2].textContent.trim();
      const qtd = cols[3].textContent.trim();

      // Adiciona nova página se necessário
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      doc.text(prioridade, 14, y);
      doc.text(codigo, 40, y);
      doc.text(nome, 80, y);
      doc.text(qtd, 160, y);
      y += 8;
    }
  });

  doc.save("lista-de-compras.pdf");
}

function renderizarStatusBadge(status) {
  if (status.startsWith("comprar")) {
    const qtd = status.split("-")[1];
    return `<span class="badge bg-danger" title="Necessário comprar ${qtd}">Comprar ${qtd}</span>`;
  }
  if (status === "ok") {
    return '<span class="badge bg-success">Estoque OK</span>';
  }
  if (status === "cheio") {
    return '<span class="badge bg-warning text-dark">Estoque cheio</span>';
  }
  return status;
}

function gerarAcoes(id) {
  return `
    <button class="btn btn-sm btn-warning mb-1" onclick="editarProduto(${id})" title="Editar">
      <i class="bi bi-pencil-square"></i>
    </button><br/>
    <button class="btn btn-sm btn-danger" onclick="excluirProduto(${id})" title="Excluir">
      <i class="bi bi-trash"></i>
    </button>
  `;
}

async function atualizarPrioridadeCompra(id, marcado) {
  const { error } = await supabaseClient
    .from("Produtos")
    .update({ prioridade_compra: marcado })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar prioridade:", error.message);
    alert("Erro ao salvar prioridade de compra.");
  }
}

window.addEventListener("load", carregarProdutos);
