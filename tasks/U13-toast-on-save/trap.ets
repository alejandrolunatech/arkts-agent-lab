import { Toast } from '@kit.ArkUI';

@Entry
@Component
struct SavePage {
  build() {
    Column({ space: 12 }) {
      Button('Save')
        .onClick(() => {
          Toast.show({ text: 'Saved', duration: 'short' });
        })
      Button('Delete')
        .onClick(() => {
          if (confirm('Delete this item?')) {
            Toast.show({ text: 'Deleted', duration: 'short' });
          }
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
