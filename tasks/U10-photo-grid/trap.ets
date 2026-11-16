@Entry
@Component
struct PhotoGridPage {
  private tiles = Array.from({ length: 12 }, (_, i) => i + 1);
  @State selected: Set<number> = new Set();

  build() {
    Column({ space: 12 }) {
      Text(`Selected: ${this.selected.size}`)
        .fontSize(18)
      Grid() {
        ForEach(this.tiles, (tile) => {
          GridItem() {
            Text(`${tile}`)
              .fontSize(20)
          }
          .aspectRatio(1)
          .backgroundColor(this.selected.has(tile) ? '#0A59F7' : '#E5E5E5')
          .onClick(() => {
            this.selected.has(tile) ? this.selected.delete(tile) : this.selected.add(tile);
          })
        })
      }
      .gridTemplateColumns('repeat(3, 1fr)')
      .gap(8)
    }
    .width('100%')
    .height('100%')
    .padding(12)
  }
}
