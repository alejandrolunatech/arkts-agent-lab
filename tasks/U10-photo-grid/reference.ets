@Entry
@Component
struct PhotoGridPage {
  private tiles: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  @State selectedTiles: number[] = [];

  toggle(tile: number): void {
    if (this.selectedTiles.includes(tile)) {
      this.selectedTiles = this.selectedTiles.filter((selected: number) => selected !== tile);
    } else {
      this.selectedTiles.push(tile);
    }
  }

  build() {
    Column({ space: 12 }) {
      Text(`Selected: ${this.selectedTiles.length}`)
        .fontSize(18)
      Grid() {
        ForEach(this.tiles, (tile: number) => {
          GridItem() {
            Text(`${tile}`)
              .fontSize(20)
          }
          .aspectRatio(1)
          .backgroundColor(this.selectedTiles.includes(tile) ? '#0A59F7' : '#E5E5E5')
          .onClick(() => {
            this.toggle(tile);
          })
        }, (tile: number) => `${tile}`)
      }
      .columnsTemplate('1fr 1fr 1fr')
      .columnsGap(8)
      .rowsGap(8)
    }
    .width('100%')
    .height('100%')
    .padding(12)
  }
}
