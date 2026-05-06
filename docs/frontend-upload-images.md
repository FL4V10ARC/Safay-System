# Upload de Imagens de Produtos — Safay System

> **Resumo:** O frontend envia imagens para o Firebase Storage e salva apenas a URL gerada no Firestore, nunca o arquivo em si.

---

## Índice

- [Visão geral](#visão-geral)
- [Fluxo completo](#fluxo-completo)
- [Caminho no Storage](#caminho-no-storage)
- [Campos de imagem no produto](#campos-de-imagem-no-produto)
- [Implementação](#implementação)
  - [Função de upload](#função-de-upload)
  - [Como usar na prática](#como-usar-na-prática)
- [Regras de segurança](#regras-de-segurança)
- [Functions relacionadas](#functions-relacionadas)
- [Erros comuns](#erros-comuns)

---

## Visão geral

O Safay segue uma separação clara de responsabilidades no armazenamento de imagens:

| O que vai para onde | Destino |
|---|---|
| Arquivo de imagem (binário) | Firebase Storage |
| URL pública da imagem | Firestore (campo do produto) |

O frontend **nunca** salva imagens diretamente no Firestore. O Firestore armazena apenas a URL gerada pelo Storage após o upload.

---

## Fluxo completo

O upload de imagem deve seguir esta sequência obrigatória. A ordem importa: o `productId` precisa existir antes do upload, e a `imageUrl` precisa existir antes do `updateProduct`.

```
1. createProduct()
        │
        ▼
2. Recebe productId   ← ID gerado pelo Firestore
        │
        ▼
3. uploadProductImage(file, productId)   ← envia para o Storage
        │
        ▼
4. Recebe imageUrl   ← URL pública retornada pelo Storage
        │
        ▼
5. updateProduct({ productId, coverImage: imageUrl })   ← salva no Firestore
```

### Por que essa ordem?

- O `productId` é necessário para montar o caminho correto no Storage (`products/{productId}/...`).
- Sem o upload finalizado, não há URL para salvar.
- O `updateProduct` só é chamado após o Storage confirmar o upload e retornar a URL.

---

## Caminho no Storage

Todas as imagens de produto devem ser salvas seguindo este padrão:

```
products/{productId}/{fileName}
```

### Exemplo real

```
products/abc123/vestido-indiano.jpg
```

### Como o `fileName` é gerado

Para evitar colisões entre arquivos com o mesmo nome, o nome do arquivo deve incluir um timestamp:

```js
const fileName = `${Date.now()}-${file.name}`;
// Resultado: "1713890422000-vestido-indiano.jpg"
```

---

## Campos de imagem no produto

Cada documento de produto no Firestore possui dois campos dedicados a imagens:

| Campo | Tipo | Descrição |
|---|---|---|
| `coverImage` | `string` | URL da imagem principal (capa) do produto |
| `gallery` | `string[]` | Array de URLs para imagens adicionais do produto |

### Exemplo de documento no Firestore

```json
{
  "id": "abc123",
  "name": "Vestido Indiano",
  "price": 89.90,
  "coverImage": "https://storage.googleapis.com/safay.../vestido-indiano.jpg",
  "gallery": [
    "https://storage.googleapis.com/safay.../detalhe-1.jpg",
    "https://storage.googleapis.com/safay.../detalhe-2.jpg"
  ]
}
```

---

## Implementação

### Função de upload

Crie o arquivo `src/services/storageService.js` (ou `.ts`) com a seguinte função:

```js
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Faz upload de uma imagem para o Firebase Storage
 * e retorna a URL pública gerada.
 *
 * @param {File} file - Arquivo de imagem selecionado pelo usuário
 * @param {string} productId - ID do produto já criado no Firestore
 * @returns {Promise<string>} URL pública da imagem
 */
export async function uploadProductImage(file, productId) {
  const storage = getStorage();

  // Nome único para evitar sobrescrever arquivos com o mesmo nome
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `products/${productId}/${fileName}`;

  const imageRef = ref(storage, filePath);

  // Faz o upload com o tipo MIME correto
  await uploadBytes(imageRef, file, {
    contentType: file.type,
  });

  // Retorna a URL pública permanente
  const imageUrl = await getDownloadURL(imageRef);

  return imageUrl;
}
```

### Como usar na prática

#### Fluxo completo em um componente

```js
import { createProduct, updateProduct } from "./services/productService";
import { uploadProductImage } from "./services/storageService";

async function handleProductSubmit(formData, imageFile) {
  try {
    // 1. Cria o produto e obtém o ID
    const productId = await createProduct({
      name: formData.name,
      price: formData.price,
      category: formData.category,
    });

    // 2. Faz upload da imagem usando o ID recebido
    const imageUrl = await uploadProductImage(imageFile, productId);

    // 3. Atualiza o produto com a URL da imagem
    await updateProduct({
      productId,
      coverImage: imageUrl,
    });

    console.log("Produto criado com sucesso:", productId);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    throw error;
  }
}
```

#### Upload de múltiplas imagens (galeria)

```js
async function handleProductWithGallery(formData, coverFile, galleryFiles) {
  // 1. Cria o produto
  const productId = await createProduct(formData);

  // 2. Upload da imagem de capa
  const coverImage = await uploadProductImage(coverFile, productId);

  // 3. Upload paralelo das imagens da galeria
  const galleryUrls = await Promise.all(
    galleryFiles.map((file) => uploadProductImage(file, productId))
  );

  // 4. Atualiza o produto com todas as imagens
  await updateProduct({
    productId,
    coverImage,
    gallery: galleryUrls,
  });
}
```

---

## Regras de segurança

O Firebase Storage está configurado com as seguintes regras. **Não altere essas regras sem alinhar com o time.**

| Regra | Detalhe |
|---|---|
| Leitura pública | Qualquer pessoa pode visualizar as imagens (necessário para exibição no app) |
| Upload por autenticado | Apenas usuários com sessão ativa podem fazer upload |
| Upload por admin | Apenas usuários com role `admin` podem fazer upload de produto |
| Tipo de arquivo | Somente imagens (`image/*`) são aceitas |
| Tamanho máximo | 5 MB por arquivo |

### Exemplo das regras no Firebase Console

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{productId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.role == 'admin'
                   && request.resource.contentType.matches('image/.*')
                   && request.resource.size <= 5 * 1024 * 1024;
    }
  }
}
```

---

## Functions relacionadas

| Function | Descrição |
|---|---|
| `createProduct` | Cria o documento do produto no Firestore e retorna o `productId` |
| `updateProduct` | Atualiza campos do produto existente, incluindo `coverImage` e `gallery` |
| `getProducts` | Retorna a lista de produtos com suas imagens |
| `getProductById` | Retorna um produto específico pelo ID |

---

## Erros comuns

### Upload antes de criar o produto

```js
// ❌ Errado — productId ainda não existe
const imageUrl = await uploadProductImage(file, undefined);
```

Sempre chame `createProduct` primeiro e aguarde o `productId` antes de iniciar o upload.

---

### Salvar imagem diretamente no Firestore

```js
// ❌ Errado — Firestore não armazena binários
await updateProduct({ productId, image: file });
```

O Firestore só deve receber a **URL** (string), nunca o arquivo.

---

### Não aguardar o upload antes de atualizar

```js
// ❌ Errado — race condition: updateProduct pode ser chamado antes do upload terminar
uploadProductImage(file, productId);
updateProduct({ productId, coverImage: "???" });

// ✅ Correto — await garante a ordem
const imageUrl = await uploadProductImage(file, productId);
await updateProduct({ productId, coverImage: imageUrl });
```

---

### Arquivo acima do limite

O Storage rejeitará arquivos acima de **5 MB**. Valide no frontend antes de tentar o upload:

```js
const MAX_SIZE_MB = 5;

if (file.size > MAX_SIZE_MB * 1024 * 1024) {
  alert("A imagem deve ter no máximo 5 MB.");
  return;
}
```