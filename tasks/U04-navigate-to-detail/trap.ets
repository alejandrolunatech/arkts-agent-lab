import router from '@ohos.router';

interface Product {
  id: number;
  name: string;
}

@Entry
@Component
struct ProductListPage {
  private products: Product[] = [
    { id: 1, name: 'Desk lamp' },
    { id: 2, name: 'Notebook' },
    { id: 3, name: 'Water bottle' }
  ];

  build() {
    List({ space: 8 }) {
      ForEach(this.products, (product: Product) => {
        ListItem() {
          Text(product.name)
            .fontSize(18)
            .width('100%')
            .padding(12)
        }
        .onClick(() => {
          router.push(`/pages/Detail?id=${product.id}`);
        })
      }, (product: Product) => product.id.toString())
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
