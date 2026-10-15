import { addMonths, getCurrentMonth } from '../utils/format.js'

/**
 * Dados de exemplo iniciais.
 *
 * IMPORTANTE: nao existe nenhuma despesa fixa "chumbada". Estes itens sao
 * apenas exemplos totalmente editaveis e removiveis pela interface. O usuario
 * tem autonomia total para criar, alterar ou excluir tudo.
 */
export function buildSeedData() {
  const current = getCurrentMonth()
  const previous = addMonths(current, -1)

  const categories = [
    {
      id: 'cat_moradia',
      name: 'Moradia',
      color: '#ef4444',
      subcategories: [
        { id: 'sub_aluguel', name: 'Aluguel' },
        { id: 'sub_condominio', name: 'Condomínio' },
        { id: 'sub_energia', name: 'Energia' },
        { id: 'sub_agua', name: 'Água' },
        { id: 'sub_internet', name: 'Internet' },
      ],
    },
    {
      id: 'cat_alimentacao',
      name: 'Alimentação',
      color: '#f97316',
      subcategories: [
        { id: 'sub_mercado', name: 'Mercado' },
        { id: 'sub_restaurante', name: 'Restaurante' },
        { id: 'sub_delivery', name: 'Delivery' },
      ],
    },
    {
      id: 'cat_transporte',
      name: 'Transporte',
      color: '#eab308',
      subcategories: [
        { id: 'sub_combustivel', name: 'Combustível' },
        { id: 'sub_pedagio', name: 'Pedágio' },
        { id: 'sub_manutencao', name: 'Manutenção' },
      ],
    },
    {
      id: 'cat_educacao',
      name: 'Educação',
      color: '#22c55e',
      subcategories: [
        { id: 'sub_cursos', name: 'Cursos' },
        { id: 'sub_livros', name: 'Livros' },
      ],
    },
    {
      id: 'cat_lazer',
      name: 'Lazer',
      color: '#3b82f6',
      subcategories: [
        { id: 'sub_streaming', name: 'Streaming' },
        { id: 'sub_viagens', name: 'Viagens' },
      ],
    },
    {
      id: 'cat_saude',
      name: 'Saúde',
      color: '#a855f7',
      subcategories: [
        { id: 'sub_plano', name: 'Plano de Saúde' },
        { id: 'sub_farmacia', name: 'Farmácia' },
      ],
    },
  ]

  const make = (data) => ({
    id: data.id,
    description: data.description,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    expenseType: data.expenseType,
    valueType: data.valueType,
    plannedValue: data.plannedValue,
    actualValue: data.valueType === 'fixo' ? data.plannedValue : data.actualValue ?? data.plannedValue,
    status: data.status,
    referenceMonth: data.month,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const expenses = [
    // ---- Mes atual ----
    make({ id: 'exp_1', description: 'Aluguel do apartamento', categoryId: 'cat_moradia', subcategoryId: 'sub_aluguel', expenseType: 'fixa', valueType: 'fixo', plannedValue: 2200, status: 'pago', month: current }),
    make({ id: 'exp_2', description: 'Condomínio', categoryId: 'cat_moradia', subcategoryId: 'sub_condominio', expenseType: 'fixa', valueType: 'fixo', plannedValue: 650, status: 'pago', month: current }),
    make({ id: 'exp_3', description: 'Conta de luz', categoryId: 'cat_moradia', subcategoryId: 'sub_energia', expenseType: 'variavel', valueType: 'manual', plannedValue: 320, actualValue: 356.4, status: 'pendente', month: current }),
    make({ id: 'exp_4', description: 'Compras do mês', categoryId: 'cat_alimentacao', subcategoryId: 'sub_mercado', expenseType: 'variavel', valueType: 'manual', plannedValue: 1200, actualValue: 1385.9, status: 'pago', month: current }),
    make({ id: 'exp_5', description: 'Internet fibra', categoryId: 'cat_moradia', subcategoryId: 'sub_internet', expenseType: 'fixa', valueType: 'fixo', plannedValue: 129.9, status: 'pago', month: current }),
    make({ id: 'exp_6', description: 'Combustível', categoryId: 'cat_transporte', subcategoryId: 'sub_combustivel', expenseType: 'variavel', valueType: 'manual', plannedValue: 450, actualValue: 402.3, status: 'pendente', month: current }),
    make({ id: 'exp_7', description: 'Streaming de vídeo', categoryId: 'cat_lazer', subcategoryId: 'sub_streaming', expenseType: 'fixa', valueType: 'fixo', plannedValue: 55.9, status: 'pago', month: current }),
    make({ id: 'exp_8', description: 'Plano de saúde', categoryId: 'cat_saude', subcategoryId: 'sub_plano', expenseType: 'fixa', valueType: 'fixo', plannedValue: 480, status: 'pago', month: current }),
    make({ id: 'exp_9', description: 'Jantar em família', categoryId: 'cat_alimentacao', subcategoryId: 'sub_restaurante', expenseType: 'variavel', valueType: 'manual', plannedValue: 200, actualValue: 240, status: 'pendente', month: current }),
    make({ id: 'exp_10', description: 'Curso de inglês', categoryId: 'cat_educacao', subcategoryId: 'sub_cursos', expenseType: 'fixa', valueType: 'fixo', plannedValue: 350, status: 'pago', month: current }),

    // ---- Mes anterior (para comparativo) ----
    make({ id: 'exp_p1', description: 'Aluguel do apartamento', categoryId: 'cat_moradia', subcategoryId: 'sub_aluguel', expenseType: 'fixa', valueType: 'fixo', plannedValue: 2200, status: 'pago', month: previous }),
    make({ id: 'exp_p2', description: 'Condomínio', categoryId: 'cat_moradia', subcategoryId: 'sub_condominio', expenseType: 'fixa', valueType: 'fixo', plannedValue: 640, status: 'pago', month: previous }),
    make({ id: 'exp_p3', description: 'Conta de luz', categoryId: 'cat_moradia', subcategoryId: 'sub_energia', expenseType: 'variavel', valueType: 'manual', plannedValue: 300, actualValue: 298.1, status: 'pago', month: previous }),
    make({ id: 'exp_p4', description: 'Compras do mês', categoryId: 'cat_alimentacao', subcategoryId: 'sub_mercado', expenseType: 'variavel', valueType: 'manual', plannedValue: 1200, actualValue: 1590.4, status: 'pago', month: previous }),
    make({ id: 'exp_p5', description: 'Internet fibra', categoryId: 'cat_moradia', subcategoryId: 'sub_internet', expenseType: 'fixa', valueType: 'fixo', plannedValue: 129.9, status: 'pago', month: previous }),
    make({ id: 'exp_p6', description: 'Combustível', categoryId: 'cat_transporte', subcategoryId: 'sub_combustivel', expenseType: 'variavel', valueType: 'manual', plannedValue: 450, actualValue: 512.7, status: 'pago', month: previous }),
    make({ id: 'exp_p7', description: 'Streaming de vídeo', categoryId: 'cat_lazer', subcategoryId: 'sub_streaming', expenseType: 'fixa', valueType: 'fixo', plannedValue: 55.9, status: 'pago', month: previous }),
    make({ id: 'exp_p8', description: 'Plano de saúde', categoryId: 'cat_saude', subcategoryId: 'sub_plano', expenseType: 'fixa', valueType: 'fixo', plannedValue: 480, status: 'pago', month: previous }),
    make({ id: 'exp_p9', description: 'Cinema e lazer', categoryId: 'cat_lazer', subcategoryId: 'sub_streaming', expenseType: 'variavel', valueType: 'manual', plannedValue: 150, actualValue: 175, status: 'pago', month: previous }),
    make({ id: 'exp_p10', description: 'Curso de inglês', categoryId: 'cat_educacao', subcategoryId: 'sub_cursos', expenseType: 'fixa', valueType: 'fixo', plannedValue: 350, status: 'pago', month: previous }),
  ]

  return { categories, expenses }
}
