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

function formatarData(dataISO) {
  if (!dataISO) return "-";
  const data = new Date(dataISO);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function corStatus(status) {
  switch (status) {
    case "ok":
      return "success";  // verde
    case "comprar":
      return "danger";   // vermelho
    case "cheio":
      return "primary";  // azul
    default:
      return "secondary"; // cinza
  }
}

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

const formProduto = document.getElementById("form-produto");
if (formProduto) {
  formProduto.addEventListener("submit", async (e) => {
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
      await supabaseClient.from("Produtos").insert([{
        codigo, nome, qtd_minima, qtd_maxima, qtd_atual, categoria, atualizado_em: new Date().toISOString()
      }]);
    }

    e.target.reset();
    carregarProdutos();
  });
}

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
    const opcoesExtras = [];
    const textoExtras = opcoesExtras.length > 0 ? opcoesExtras.join(", ") : "";

    linha.innerHTML = `
      <td>${textoExtras}</td>
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

async function carregarOrdensProducao() {
  const filtroData = document.getElementById("filtro-data-inicio")?.value;
  let query = supabaseClient
    .from("OrdensProducao")
    .select("*")
    .order("id", { ascending: false });

  if (filtroData) {
    const dataInicial = new Date(filtroData);
    const proximoDia = new Date(dataInicial);
    proximoDia.setDate(dataInicial.getDate() + 1);

    query = query
      .gte("data_inicio", dataInicial.toISOString())
      .lt("data_inicio", proximoDia.toISOString());
  }

  const { data: ordens, error } = await query;

  if (error) {
    console.error("Erro ao carregar ordens:", error.message);
    return;
  }

  const statusContagem = {
    "não iniciado": 0,
    "em produção": 0,
    "pausado": 0,
    "finalizado": 0
  };

  const tabela = document.getElementById("tabela-producao");
  if (!tabela) return;
  tabela.innerHTML = "";

  ordens.forEach(ordem => {
    const opcoesExtras = [];
    if (ordem.valvula_usada) opcoesExtras.push("Válvula Usada");
    if (ordem.ponteira_usada) opcoesExtras.push("Ponteira Usada");
    if (ordem.valvula_retificada) opcoesExtras.push("Válvula Retificada");

    const textoExtras = opcoesExtras.length > 0
      ? `<br><small class="text-warning">${opcoesExtras.join(", ")}</small>`
      : "";

    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${ordem.id}</td>
      <td>${ordem.nome_produto}</td>
      <td>${ordem.sku || "-"}</td>
      <td>${ordem.codigo_produto}</td>
      <td>${ordem.quantidade}</td>
      <td>${ordem.tecnico || "-"}</td>
      <td>${ordem.data_inicio ? formatarData(ordem.data_inicio) : "-"}</td>
      <td>${ordem.data_fim ? formatarData(ordem.data_fim) : "-"}</td>
      <td>R$ ${ordem.custo ? ordem.custo.toFixed(2) : '0.00'}</td>
      <td>
        <span class="badge ${corStatusProducao(ordem.status)}">${ordem.status}</span>
        ${textoExtras}
      </td>
      <td>
        <a href="editar-ordem.html?id=${ordem.id}" class="btn btn-sm btn-warning">
          <i class="bi bi-pencil-square"></i>
        </a>
      </td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="excluirOrdem(${ordem.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
      <td>
  <a href="editar-ordem.html?id=${ordem.id}" class="btn btn-sm btn-warning me-1">
    <i class="bi bi-pencil-square"></i>
  </a>
  <button class="btn btn-sm btn-secondary" onclick="exportarOrdemPDF(${ordem.id})">
    <i class="bi bi-file-earmark-pdf"></i>
  </button>
</td>
    `;
    tabela.appendChild(linha);

    if (ordem.status in statusContagem) {
      statusContagem[ordem.status]++;
    }
  });

  document.querySelector("#producao .bg-secondary h5").textContent = statusContagem["não iniciado"];
  document.querySelector("#producao .bg-primary h5").textContent = statusContagem["em produção"];
  document.querySelector("#producao .bg-warning h5").textContent = statusContagem["pausado"];
  document.querySelector("#producao .bg-success h5").textContent = statusContagem["finalizado"];
}

function corStatusProducao(status) {
  switch (status) {
    case "não iniciado": return "bg-secondary";
    case "em produção": return "bg-primary";
    case "pausado": return "bg-warning text-dark";
    case "finalizado": return "bg-success";
    default: return "bg-light text-dark";
  }
}

const abaProducao = document.querySelector('a[href="#producao"]');
if (abaProducao) {
  abaProducao.addEventListener("click", () => {
    carregarOrdensProducao();
  });
}

async function excluirOrdem(id) {
  const confirmar = confirm("Tem certeza que deseja excluir esta ordem de produção?");
  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("OrdensProducao")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Erro ao excluir ordem.");
    console.error("Erro:", error.message);
  } else {
    alert("Ordem excluída com sucesso!");
    carregarOrdensProducao(); // Atualiza a lista
  }
}

let insumos = [];
let insumoSelecionado = null;

function filtrarSugestoesInsumos() {
  const input = document.getElementById("busca-insumo");
  const sugestoesDiv = document.getElementById("sugestoes-insumos");

  if (!input || !sugestoesDiv) return;

  const termo = input.value.toLowerCase();
  sugestoesDiv.innerHTML = "";

  if (!termo.trim()) return;

  const filtrados = todosProdutos.filter(p =>
    p.nome.toLowerCase().includes(termo) || (p.codigo || "").toLowerCase().includes(termo)
  );

  filtrados.forEach(produto => {
    const item = document.createElement("button");
    item.className = "list-group-item list-group-item-action";
    item.textContent = `${produto.nome} (${produto.codigo || "sem código"})`;
    item.onclick = () => selecionarInsumo(produto);
    sugestoesDiv.appendChild(item);
  });
}

function selecionarInsumo(produto) {
  insumoSelecionado = produto;
  document.getElementById("busca-insumo").value = `${produto.nome} (${produto.codigo || ""})`;
  document.getElementById("sugestoes-insumos").innerHTML = "";
}

function adicionarInsumo() {
  if (!insumoSelecionado) {
    alert("Selecione um insumo válido!");
    return;
  }

  const custo = parseFloat(document.getElementById("custo-insumo").value);
  if (isNaN(custo)) {
    alert("Informe o custo do insumo.");
    return;
  }

  const novoInsumo = {
    nome: insumoSelecionado.nome,
    codigo: insumoSelecionado.codigo,
    custo
  };

  insumos.push(novoInsumo);

  renderizarInsumos();

  // Limpa campos
  document.getElementById("busca-insumo").value = "";
  document.getElementById("custo-insumo").value = "";
  document.getElementById("sugestoes-insumos").innerHTML = "";
  insumoSelecionado = null;
}


function removerInsumo(index) {
  insumos.splice(index, 1);
  renderizarInsumos();
}

const formOrdem = document.getElementById("form-ordem-producao");
if (formOrdem) {
  formOrdem.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome_produto = document.getElementById("produto-producao").value;
    const codigo_produto = document.getElementById("codigo-producao").value;
    const quantidade = parseFloat(document.getElementById("quantidade-producao").value);
    const tecnico = document.getElementById("tecnico-producao").value;
    const data_inicio = document.getElementById("data-inicio").value;
    const data_fim = document.getElementById("data-fim").value;
    const status = document.getElementById("status-producao").value;
    const custo_total = insumos.reduce((total, i) => total + i.custo, 0);

    const { error } = await supabaseClient
      .from("OrdensProducao")
      .insert([{
        nome_produto,
        codigo_produto,
        quantidade,
        tecnico,
        data_inicio,
        data_fim,
        status,
        custo: custo_total,
        insumos
      }]);

    if (error) {
      alert("Erro ao salvar ordem: " + error.message);
    } else {
      alert("Ordem salva com sucesso!");
      formOrdem.reset();
      insumos = [];
      renderizarInsumos();
      carregarOrdensProducao();
    }
  });
}

function renderizarInsumos() {
  const lista = document.getElementById("lista-insumos");
  lista.innerHTML = "";
  insumos.forEach((insumo, index) => {
    const item = document.createElement("li");
    item.className = "list-group-item bg-dark text-white d-flex justify-content-between align-items-center";
    item.innerHTML = `
      ${insumo.nome} (SKU: ${insumo.codigo}) - R$ ${insumo.custo.toFixed(2)}
      <button class="btn btn-sm btn-danger" onclick="removerInsumo(${index})">Remover</button>
    `;
    lista.appendChild(item);
  });
}

async function carregarSugestoesProdutos() {
  const { data, error } = await supabaseClient
    .from("Produtos")
    .select("id, nome, codigo, categoria");

  if (error) {
    console.error("Erro ao carregar produtos para autocomplete:", error.message);
    return;
  }

  todosProdutos = data || [];
}

window.addEventListener("DOMContentLoaded", () => {
  const temEstoque = document.getElementById("produtos-lista");
  if (temEstoque) carregarProdutos();

  const formOrdem = document.getElementById("form-ordem-producao");
  if (formOrdem) {
    carregarSugestoesProdutos();
    carregarOrdensProducao();
  }
});

function exportarOrdensParaExcel() {
  const tabela = document.getElementById("tabela-producao");
  if (!tabela) return;

  const wb = XLSX.utils.book_new();
  const ws_data = [["ID", "Produto", "SKU", "Código", "Quantidade", "Técnico", "Data Início", "Data Fim", "Custo", "Status", "Extras"]];

  for (const linha of tabela.querySelectorAll("tbody tr")) {
    const colunas = linha.querySelectorAll("td");
    const extras = colunas[9]?.querySelector("small")?.textContent || "";
    ws_data.push([
      colunas[0]?.textContent || "",
      colunas[1]?.textContent || "",
      colunas[2]?.textContent || "",
      colunas[3]?.textContent || "",
      colunas[4]?.textContent || "",
      colunas[5]?.textContent || "",
      colunas[6]?.textContent || "",
      colunas[7]?.textContent || "",
      colunas[8]?.textContent || "",
      colunas[9]?.querySelector("span")?.textContent || "",
      extras
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Ordens");
  XLSX.writeFile(wb, "OrdensProducao_Filtradas.xlsx");
}

function exportarOrdensParaPDF() {
  const doc = new jspdf.jsPDF();
  const tabela = document.getElementById("tabela-producao");
  if (!tabela) return;

  const rows = [];

  for (const linha of tabela.querySelectorAll("tbody tr")) {
    const colunas = linha.querySelectorAll("td");
    const extras = colunas[9]?.querySelector("small")?.textContent || "";
    rows.push([
      colunas[0]?.textContent || "",
      colunas[1]?.textContent || "",
      colunas[2]?.textContent || "",
      colunas[3]?.textContent || "",
      colunas[4]?.textContent || "",
      colunas[5]?.textContent || "",
      colunas[6]?.textContent || "",
      colunas[7]?.textContent || "",
      colunas[8]?.textContent || "",
      colunas[9]?.querySelector("span")?.textContent || "",
      extras
    ]);
  }

  doc.autoTable({
    head: [["ID", "Produto", "SKU", "Código", "Quantidade", "Técnico", "Data Início", "Data Fim", "Custo", "Status", "Extras"]],
    body: rows,
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0] }
  });

  doc.save("OrdensProducao_Filtradas.pdf");
}

async function exportarOrdemPDF(id) {
  const { data: ordem, error } = await supabaseClient
    .from("OrdensProducao")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !ordem) {
    alert("Erro ao carregar a ordem de produção.");
    return;
  }

  const doc = new jspdf.jsPDF();

  const opcoesExtras = [];
  if (ordem.valvula_usada) opcoesExtras.push("Válvula Usada");
  if (ordem.ponteira_usada) opcoesExtras.push("Ponteira Usada");
  if (ordem.valvula_retificada) opcoesExtras.push("Válvula Retificada");

  doc.setFontSize(16);
  doc.text("Ordem de Produção", 14, 15);

  doc.setFontSize(12);
  doc.text(`ID: ${ordem.id}`, 14, 25);
  doc.text(`Produto: ${ordem.nome_produto}`, 14, 32);
  doc.text(`SKU: ${ordem.sku || '-'}`, 14, 39);
  doc.text(`Código Produto: ${ordem.codigo_produto || '-'}`, 14, 46);
  doc.text(`Quantidade: ${ordem.quantidade}`, 14, 53);
  doc.text(`Técnico: ${ordem.tecnico || '-'}`, 14, 60);
  doc.text(`Data Início: ${ordem.data_inicio ? formatarData(ordem.data_inicio) : '-'}`, 14, 67);
  doc.text(`Data Fim: ${ordem.data_fim ? formatarData(ordem.data_fim) : '-'}`, 14, 74);
  doc.text(`Depósito Origem: ${ordem.deposito_origem || '-'}`, 14, 81);
  doc.text(`Depósito Destino: ${ordem.deposito_destino || '-'}`, 14, 88);
  doc.text(`Custo Total: R$ ${ordem.custo?.toFixed(2) || '0.00'}`, 14, 95);

  if (opcoesExtras.length > 0) {
    doc.text(`Opções Técnicas: ${opcoesExtras.join(", ")}`, 14, 102);
  }

  // Tabela de insumos
  if (ordem.insumos && ordem.insumos.length > 0) {
    doc.autoTable({
      startY: 110,
      head: [['Nome', 'Código', 'Código Entrada', 'Custo (R$)']],
      body: ordem.insumos.map(insumo => [
        insumo.nome,
        insumo.codigo || '-',
        insumo.codigo_entrada || '-',
        `R$ ${insumo.custo?.toFixed(2) || '0.00'}`
      ]),
    });
  }

  doc.save(`ordem_producao_${ordem.id}.pdf`);
}

function formatarData(dataISO) {
  const data = new Date(dataISO);
  return data.toLocaleDateString('pt-BR');
}