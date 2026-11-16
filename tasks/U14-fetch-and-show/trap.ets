interface Item {
  id: number;
  name: string;
}

@Entry
@Component
struct ItemsPage {
  @State items: Item[] = [];
  @State loading: boolean = true;
  @State error: string | null = null;

  async aboutToAppear() {
    try {
      const response = await fetch('https://example.com/api/items');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: any = await response.json();
      this.items = data;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  build() {
    Column() {
      if (this.loading) {
        Text('Loading...')
      } else if (this.error) {
        Text(`Could not load the items: ${this.error}`)
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
