class Address {
  id: string;
  label: string;
  street: string;

  constructor(id: string, label: string, street: string) {
    this.id = id;
    this.label = label;
    this.street = street;
  }
}

class PickRequest {
  currentId: string;

  constructor(currentId: string) {
    this.currentId = currentId;
  }
}

class PickResult {
  chosenId: string;

  constructor(chosenId: string) {
    this.chosenId = chosenId;
  }
}

const ADDRESSES: Address[] = [
  new Address('home', 'Home', '12 Elm Street'),
  new Address('work', 'Work', '400 Harbour Road'),
  new Address('gym', 'Gym', '7 Mill Lane'),
];

function labelOf(id: string): string {
  for (const address of ADDRESSES) {
    if (address.id === id) {
      return address.label;
    }
  }
  return '';
}

@Component
struct AddressRow {
  @Consume('largeText') largeText: boolean;
  @Prop address: Address;
  @Prop current: boolean = false;
  onPick: () => void = () => {};

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
    .onClick(() => {
      this.onPick();
    })
  }
}

@Component
struct AddressScreen {
  @Consume('checkoutStack') stack: NavPathStack;
  @State currentId: string = '';

  build() {
    NavDestination() {
      List({ space: 8 }) {
        ForEach(ADDRESSES, (address: Address) => {
          ListItem() {
            AddressRow({
              address: address,
              current: address.id === this.currentId,
              onPick: () => {
                this.stack.pop(new PickResult(address.id));
              }
            })
          }
        }, (address: Address) => address.id)
      }
      .width('100%')
      .height('100%')
    }
    .title('Addresses')
    .onReady((context: NavDestinationContext) => {
      const request = context.pathInfo.param as PickRequest;
      this.currentId = request.currentId;
    })
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
    this.stack.pushPathByName('addresses', new PickRequest(this.addressId), (info: PopInfo) => {
      const result = info.result;
      if (result instanceof PickResult) {
        this.addressId = result.chosenId;
      }
    });
  }

  build() {
    Navigation(this.stack) {
      Column({ space: 16 }) {
        Text(`Deliver to: ${labelOf(this.addressId)}`)
          .fontSize(20)
        Button('Change address')
          .onClick(() => {
            this.openAddresses();
          })
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
