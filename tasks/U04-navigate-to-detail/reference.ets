import { BusinessError } from '@kit.BasicServicesKit';

interface Product {
  id: number;
  name: string;
}

interface DetailParams {
  id: number;
}

@Entry
@Component
struct ProductListPage {
  private products: Product[] = [
    { id: 1, name: 'Desk lamp' },
    { id: 2, name: 'Notebook' },
    { id: 3, name: 'Water bottle' }
  ];

  private openDetail(product: Product): void {
    const params: DetailParams = { id: product.id };
    this.getUIContext().getRouter().pushUrl({ url: 'pages/Detail', params: params })
      .catch((error: BusinessError) => {
        console.error(`Could not open pages/Detail: ${error.code}`);
      });
  }

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
          this.openDetail(product);
        })
      }, (product: Product) => product.id.toString())
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
