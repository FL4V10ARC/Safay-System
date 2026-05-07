<div align="center">

# 🛍️ Safay System

**Backend Firebase para E-commerce de Moda**

Sistema de gestão de vendas, estoque e pedidos para a loja Safay Roupas e Variedades.

[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Functions_v2-F57C00?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Firestore](https://img.shields.io/badge/Firestore-NoSQL-039BE5?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com/products/firestore)
[![Storage](https://img.shields.io/badge/Storage-Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/products/storage)
[![Region](https://img.shields.io/badge/Região-São_Paulo-34A853?style=flat-square&logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Flávio_Carvalho-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/fl%C3%A1vio-c/)

</div>

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Stack Tecnológica](#-stack-tecnológica)
- [Arquitetura](#-arquitetura)
- [Modelagem do Banco](#-modelagem-do-banco-firestore)
- [Cloud Functions](#-cloud-functions)
- [Ciclo de Vida do Pedido](#-ciclo-de-vida-do-pedido)
- [Segurança](#-segurança)
- [Integridade de Dados](#-integridade-de-dados)
- [Índices Compostos](#-índices-compostos)
- [Como Executar](#-como-executar)
- [Deploy](#-deploy)

---

## 🎯 Visão Geral

O **Safay System** é o backend completo de um e-commerce desenvolvido com **Firebase** e **Cloud Functions v2**. Gerencia autenticação, catálogo de produtos com variantes (cor/tamanho), carrinho, pedidos e controle de estoque com audit trail completo.

**Destaques técnicos:**

- Transações atômicas com `runTransaction` em todas as operações de estoque — eliminando race conditions
- Role-based access control (RBAC) via **Custom Claims no JWT** — sem leitura de banco por requisição
- State machine explícita no ciclo de pedidos — nenhuma transição inválida é aceita
- Soft delete em produtos e variantes — histórico de pedidos nunca é corrompido
- Audit trail completo de estoque via coleção `stock_movements`
- Paginação por cursor em todas as listagens — pronto para escala
- Structured logging com `firebase-functions/logger` em todas as funções

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Uso |
|---|---|---|
| **Node.js** | 24 | Runtime das Cloud Functions |
| **Firebase Functions** | v2 | API serverless |
| **Firebase Authentication** | — | Login e-mail/senha e Google OAuth |
| **Cloud Firestore** | — | Banco de dados NoSQL |
| **Firebase Storage** | — | Armazenamento de imagens |
| **Firebase Emulators** | — | Ambiente local de desenvolvimento |
| **Região** | southamerica-east1 | São Paulo — latência otimizada para Brasil |

---

## 🏗️ Arquitetura

```
safay-system/
├── firestore.rules              # Regras de segurança do Firestore
├── firestore.indexes.json       # 8 índices compostos
├── storage.rules                # Regras de segurança do Storage
├── firebase.json                # Configuração do projeto Firebase
├── docs/
│   └── frontend-upload-images.md
└── functions/
    ├── index.js                 # Exporta todas as Cloud Functions
    ├── seed.js                  # Popula o emulador com dados de teste
    ├── config/
    │   └── firebase.js          # Inicialização do Admin SDK
    ├── utils/
    │   └── auth.js              # Validação de autenticação (Custom Claims)
    ├── cart/                    # checkoutFromCart, saveCart, getCart...
    ├── orders/                  # createOrder, confirmOrder, cancelOrder...
    ├── products/                # createProduct, adjustStock, variants...
    └── users/
        └── syncCustomerProfile.js
```

---

## 🗄️ Modelagem do Banco (Firestore)

```
users/{userId}
  name, email, phone, role, active, provider, createdAt

categories/{categoryId}
  name, active, createdAt

products/{productId}
  name, description, categoryName, basePrice
  featured, active, coverImage, gallery[]
  createdAt, deletedAt  ← soft delete

  └── variants/{variantId}
        sku, color, size, price, stock, active

carts/{userId}
  items[{ productId, variantId, quantity }], updatedAt

orders/{orderId}
  customerId, customerSnapshot  ← snapshot imutável do cliente
  items[], total, status, paymentStatus
  deliveryType, deliveryFee, deliveryAddress
  statusHistory, createdAt, updatedAt

stock_movements/{movementId}
  productId, variantId, type, reason
  quantity, previousStock, newStock
  orderId, adjustedBy, createdAt  ← audit trail completo
```

> **Customer snapshot:** os dados do cliente são copiados para dentro do pedido no momento da compra. Alterações de perfil futuras não afetam o histórico.

---

## ☁️ Cloud Functions

### 👤 Usuários

| Função | Acesso | Descrição |
|---|---|---|
| `syncCustomerProfile` | CUSTOMER | Cria ou atualiza perfil. Define Custom Claim `CUSTOMER` no primeiro acesso. |

### 📦 Produtos

| Função | Acesso | Descrição |
|---|---|---|
| `createProduct` | ADMIN | Cria produto e variantes em batch atômico — valida tudo antes de escrever. |
| `updateProduct` | ADMIN | Atualiza dados cadastrais do produto. |
| `deleteProduct` | ADMIN | Soft delete — preserva histórico de pedidos. |
| `getProducts` | Público | Lista produtos com paginação por cursor e filtros. |
| `getProductById` | Público | Retorna produto com todas as variantes ativas. |
| `createVariant` | ADMIN | Adiciona variante a produto existente. |
| `updateVariant` | ADMIN | Atualiza dados da variante (estoque bloqueado — use `adjustStock`). |
| `deleteVariant` | ADMIN | Soft delete da variante. |

### 📊 Estoque

| Função | Acesso | Descrição |
|---|---|---|
| `adjustStock` | ADMIN | Ajuste manual (IN / OUT / ADJUSTMENT) com `runTransaction` + registro automático em `stock_movements`. |
| `getStockMovements` | ADMIN | Histórico paginado de movimentações por produto/variante. |

### 🛒 Carrinho

| Função | Acesso | Descrição |
|---|---|---|
| `saveCart` | CUSTOMER | Salva ou substitui os itens do carrinho. |
| `getCart` | CUSTOMER | Retorna o carrinho do usuário logado. |
| `updateCartItem` | CUSTOMER | Adiciona ou atualiza a quantidade de um item. |
| `removeCartItem` | CUSTOMER | Remove um item específico. |
| `clearCart` | CUSTOMER | Limpa o carrinho completamente. |
| `checkoutFromCart` | CUSTOMER | Checkout com `runTransaction` — valida estoque, decrementa e cria pedido atomicamente. |

### 🧾 Pedidos

| Função | Acesso | Descrição |
|---|---|---|
| `createOrder` | CUSTOMER | Cria pedido direto (sem carrinho). `runTransaction` atômica. |
| `confirmOrder` | ADMIN | Confirma e debita estoque. Lê status dentro da transaction — evita confirmação dupla. |
| `cancelOrder` | ADMIN | Cancela e restaura estoque. Valida estado permitido. |
| `updateOrderStatus` | ADMIN | Atualiza status com state machine explícita. |
| `getOrders` | ADMIN | Lista pedidos com paginação e filtro por status. |
| `getOrderById` | CUSTOMER | Retorna pedido por ID (cliente vê apenas o próprio). |
| `getOrdersByPhone` | ADMIN | Busca pedidos pelo telefone do cliente. |

---

## 🔄 Ciclo de Vida do Pedido

```
PENDENTE  →  PAGO  →  EM_PREPARACAO  →  EM_ENTREGA  →  FINALIZADO
    │            │
    └────────────┴──────────────────────────────────────  CANCELADO
```

- `FINALIZADO` e `CANCELADO` são **estados terminais** — nenhuma transição é aceita
- O cancelamento só restaura estoque se o status for `PAGO` ou `EM_PREPARACAO` — estados onde o estoque já foi debitado
- `updateOrderStatus` rejeita qualquer transição fora do mapa acima com erro `failed-precondition`

---

## 🔒 Segurança

### Autenticação e Autorização

O sistema usa **Custom Claims no JWT** para verificar roles — sem leitura de banco por requisição:

```
ADMIN    → acesso total às funções de gestão
CUSTOMER → acesso ao próprio perfil, carrinho e pedidos
```

```javascript
// utils/auth.js — zero leitura de banco
function validateAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", ...);
  if (request.auth.token.role !== "ADMIN") throw new HttpsError("permission-denied", ...);
}
```

### Regras de Acesso por Coleção

| Coleção | Leitura | Escrita |
|---|---|---|
| `users` | Próprio usuário ou ADMIN | Próprio usuário (sem alterar `role` ou `active`) |
| `products` | Pública | Apenas ADMIN |
| `categories` | Pública | Apenas ADMIN |
| `orders` | Próprio cliente ou ADMIN | Apenas via Cloud Function |
| `carts` | Próprio usuário | Próprio usuário |
| `stock_movements` | Apenas ADMIN | Bloqueada — apenas Cloud Functions escrevem |
| `store_settings` | Pública | Apenas ADMIN |

### Storage

- Leitura pública (necessário para exibição das imagens)
- Upload restrito a ADMIN autenticado
- Tipo aceito: somente `image/*`
- Tamanho máximo: **5 MB** por arquivo
- Caminho obrigatório: `products/{productId}/{timestamp}-{fileName}`

---

## ⚛️ Integridade de Dados

Todas as operações de estoque usam `runTransaction` — leitura e escrita atômica, eliminando race conditions mesmo sob alta concorrência:

| Função | Garantia |
|---|---|
| `checkoutFromCart` | Valida estoque, decrementa e cria pedido + `stock_movement` em uma única transaction |
| `confirmOrder` | Lê status do pedido e estoque dentro da transaction — evita confirmação dupla |
| `cancelOrder` | Lê e restaura estoque dentro da transaction — evita cancelamento duplo |
| `adjustStock` | Ajuste atômico com `stock_movement` incluído na mesma transaction |
| `createOrder` | Mesma garantia do checkout para pedidos diretos |

```javascript
// Exemplo — checkoutFromCart
await db.runTransaction(async (transaction) => {
  const variantDoc = await transaction.get(variantRef); // leitura atômica
  const currentStock = variantDoc.data().stock;

  if (currentStock < item.quantity) throw new HttpsError("failed-precondition", ...);

  transaction.update(variantRef, { stock: currentStock - item.quantity });
  transaction.set(movementRef, { previousStock: currentStock, newStock, ... });
  transaction.set(orderRef, { ... });
});
```

---

## 🗂️ Índices Compostos

O arquivo `firestore.indexes.json` define 8 índices para suportar queries com filtro e ordenação simultâneos:

| Coleção | Campos | Query |
|---|---|---|
| `orders` | `status` + `createdAt DESC` | `getOrders` com filtro de status |
| `orders` | `customerId` + `createdAt DESC` | pedidos por cliente |
| `orders` | `customerSnapshot.phone` + `createdAt DESC` | `getOrdersByPhone` |
| `stock_movements` | `productId` + `createdAt DESC` | movimentações por produto |
| `stock_movements` | `productId` + `variantId` + `createdAt DESC` | movimentações por variante |
| `products` | `active` + `createdAt DESC` | `getProducts` |
| `products` | `active` + `categoryName` + `createdAt DESC` | filtro por categoria |
| `products` | `active` + `featured` + `createdAt DESC` | produtos em destaque |

---

## 🚀 Como Executar

### Pré-requisitos

- Node.js 24+
- Firebase CLI (`npm install -g firebase-tools`)
- Projeto criado no [Firebase Console](https://console.firebase.google.com/)

### Instalação

```bash
git clone https://github.com/FL4V10ARC/Safay-System.git
cd Safay-System

cd functions
npm install
cd ..
```

### Emulador local

```bash
# Inicia Auth, Firestore, Functions e Storage
firebase emulators:start

# Em outro terminal — popula com dados de teste
cd functions
node seed.js
```

Acesse a UI do emulador em **http://127.0.0.1:4000**

| Emulador | Porta |
|---|---|
| Authentication | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| UI | 4000 |

**Usuários criados pelo seed:**

| Usuário | E-mail | Senha | Role |
|---|---|---|---|
| Admin | admin@safay.com | 123456 | ADMIN |
| Cliente | cliente@safay.com | 123456 | CUSTOMER |

---

## 📤 Deploy

```bash
# Deploy completo (functions + rules + indexes)
firebase deploy

# Apenas Cloud Functions
firebase deploy --only functions

# Apenas regras de segurança
firebase deploy --only firestore:rules,storage
```

---

## 📸 Upload de Imagens

O frontend faz upload direto para o Firebase Storage e salva apenas a URL no Firestore. Fluxo obrigatório:

```
1. createProduct()                         → recebe productId
2. uploadProductImage(file, productId)     → retorna imageUrl
3. updateProduct({ productId, coverImage: imageUrl })
```

Consulte [`docs/frontend-upload-images.md`](docs/frontend-upload-images.md) para o guia completo com exemplos de código.

---

<div align="center">

Desenvolvido por [Flávio Carvalho](https://www.linkedin.com/in/fl%C3%A1vio-c/) · [FL4V10ARC](https://github.com/FL4V10ARC) · FUCAPI 2023–2026

</div>
