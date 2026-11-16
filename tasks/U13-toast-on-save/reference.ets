@Entry
@Component
struct SavePage {
  showMessage(message: string): void {
    this.getUIContext().getPromptAction().showToast({ message: message });
  }

  askBeforeDelete(): void {
    this.getUIContext().showAlertDialog({
      title: 'Delete',
      message: 'Delete this item?',
      primaryButton: {
        value: 'Cancel',
        action: () => {
        }
      },
      secondaryButton: {
        value: 'Delete',
        action: () => {
          this.showMessage('Deleted');
        }
      }
    });
  }

  build() {
    Column({ space: 12 }) {
      Button('Save')
        .onClick(() => {
          this.showMessage('Saved');
        })
      Button('Delete')
        .onClick(() => {
          this.askBeforeDelete();
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
