import { http } from '@kit.NetworkKit';

interface Item {
  id: number;
  name: string;
}

@Entry
@Component
struct ItemsPage {
  @State items: Item[] = [];
  @State loading: boolean = true;
  @State failed: boolean = false;

  aboutToAppear(): void {
    this.loadItems();
  }

  async loadItems(): Promise<void> {
    const request = http.createHttp();
    try {
      const response = await request.request('https://example.com/api/items');
      if (response.responseCode === http.ResponseCode.OK) {
        this.items = JSON.parse(response.result as string) as Item[];
      } else {
        this.failed = true;
      }
    } catch (error) {
      this.failed = true;
    } finally {
      request.destroy();
      this.loading = false;
    }
  }

  build() {
    Column() {
      if (this.loading) {
        Text('Loading...')
      } else if (this.failed) {
        Text('Could not load the items')
      } else {
        List({ space: 8 }) {
          ForEach(this.items, (item: Item) => {
            ListItem() {
              Text(item.name)
                .fontSize(18)
            }
          }, (item: Item) => `${item.id}`)
        }
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .padding(16)
  }
}
