class Address {
  constructor(public id: string, public label: string, public street: string) {}
}

const ADDRESSES: Address[] = [
  new Address('home', 'Home', '12 Elm Street'),
  new Address('work', 'Work', '400 Harbour Road'),
  new Address('gym', 'Gym', '7 Mill Lane'),
];

const labelOf = (id: string): string => ADDRESSES.find((address) => address.id === id)?.label ?? '';

@Component
struct AddressRow {
  @Consume('largeText') largeText: boolean;
  @Prop address: Address;
  @Prop current: boolean = false;
  onPick: (id: string) => void = () => {};

  build() {
    Row({ space: 12 }) {
      Column({ space: 4 }) {
        Text(this.address.label)
          .fontSize(this.largeText ? 24 : 16)
        Text(this.address.street)
          .fontSize(this.largeText ? 24 : 16)
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      if (this.current) {
        Text('Current')
          .fontSize(this.largeText ? 24 : 16)
      }
    }
    .width('100%')
    .padding(12)
    .onClick(() => this.onPick(this.address.id))
  }
}

@Component
struct AddressScreen {
  @Consume('checkoutStack') stack: NavPathStack;
  @State currentId: string = '';

  aboutToAppear(): void {
    const params = this.stack.getParamByName('addresses');
    this.currentId = params[params.length - 1].currentId;
  }

  build() {
    NavDestination() {
      List({ space: 8 }) {
        ForEach(ADDRESSES, (address: Address) => {
          ListItem() {
            AddressRow({
              address: address,
              current: address.id === this.currentId,
              onPick: (id: string) => {
                this.stack.pop({ chosenId: id });
              }
            })
          }
        }, (address: Address) => address.id)
      }
      .width('100%')
      .height('100%')
    }
    .title('Addresses')
  }
}

@Entry
@Component
struct CheckoutPage {
  @Provide('checkoutStack') stack: NavPathStack = new NavPathStack();
  @Provide('largeText') largeText: boolean = false;
  @State addressId: string = 'home';

  @Builder
  screens(name: string) {
    if (name === 'addresses') {
      AddressScreen()
    }
  }

  openAddresses(): void {
    this.stack.pushPathByName('addresses', { currentId: this.addressId }, (info: PopInfo) => {
      const { chosenId } = info.result;
      this.addressId = chosenId;
    });
  }

  build() {
    Navigation(this.stack) {
      Column({ space: 16 }) {
        Text(`Deliver to: ${labelOf(this.addressId)}`)
          .fontSize(20)
        Button('Change address')
          .onClick(() => this.openAddresses())
        Row({ space: 12 }) {
          Text('Large text')
          Toggle({ type: ToggleType.Switch, isOn: this.largeText })
            .onChange((isOn: boolean) => {
              this.largeText = isOn;
            })
        }
      }
      .width('100%')
      .padding(16)
    }
    .title('Checkout')
    .navDestination(this.screens)
  }
}
