import React, { useMemo, useState } from 'react'

import styles from '#/account/addOns/addOnList.module.scss'
import type { Organization } from '#/account/organization/organizationQuery'
import { useDisplayPrice } from '#/account/plans/useDisplayPrice.hook'
import { postCheckout, postCustomerPortal } from '#/account/stripe.api'
import type { Product, SubscriptionInfo } from '#/account/stripe.types'
import KoboSelect3 from '#/components/special/koboAccessibleSelect'
import Button from '#/components/common/ButtonNew'

interface AddOnProductRowProps {
  products: Product[]
  isBusy: boolean
  setIsBusy: (value: boolean) => void
  subscribedAddOns: SubscriptionInfo[]
  organization: Organization
}

export const AddOnProductRow = ({
  products,
  isBusy,
  setIsBusy,
  subscribedAddOns,
  organization,
}: AddOnProductRowProps) => {
  const [selectedProduct, setSelectedProduct] = useState(products[0])
  const [selectedPrice, setSelectedPrice] = useState<Product['prices'][0]>(selectedProduct.prices[0])
  const displayPrice = useDisplayPrice(selectedPrice)
  const priceOptions = useMemo(
    () =>
      selectedProduct.prices.map((price) => {
        return { value: price.id, label: price.recurring?.interval || 'me' }
      }),
    [selectedProduct],
  )

  let displayName
  let description

  if (selectedProduct.metadata.asr_seconds_limit || selectedProduct.metadata.mt_characters_limit) {
    displayName = t('NLP Package')
    description = t('Increase your transcription minutes and translations characters.')
  } else if (selectedProduct.metadata.storage_bytes_limit) {
    displayName = t('File Storage')
    description = t('Get up to 50GB of media storage on a KoboToolbox public server.')
  }

  // In practice, this variable and related onSubmit behavior
  // will only end up being true/relevant for recurring addons
  const userAlreadyHasCategoryProduct = useMemo(
    () =>
      subscribedAddOns.some((subscription) =>
        products.map((product) => product.id).includes(subscription.items[0].price.product.id),
      ),
    [subscribedAddOns, selectedPrice],
  )

  const onChangeProduct = (productId: string | null) => {
    const product = products.find((item) => item.id === productId)
    if (product) {
      setSelectedProduct(product)
      setSelectedPrice(product.prices[0])
    }
  }

  const onChangePrice = (inputPrice: string | null) => {
    if (inputPrice) {
      const priceObject = selectedProduct.prices.find((price) => inputPrice === price.id)
      if (priceObject) {
        setSelectedPrice(priceObject)
      }
    }
  }

  const onSubmit = () => {
    if (isBusy || !selectedPrice) {
      return
    }
    setIsBusy(true)
    if (userAlreadyHasCategoryProduct) {
      postCustomerPortal(organization.id)
        .then((response) => window.location.assign(response.url))
        .catch(() => setIsBusy(false))
    } else {
      postCheckout(selectedPrice.id, organization.id)
        .then((response) => window.location.assign(response.url))
        .catch(() => setIsBusy(false))
    }
  }

  const priceTableCells = (
    <div className={styles.purchase}>
      <div className={styles.oneTimePrice}>
        {selectedPrice.recurring?.interval === 'year' ? selectedPrice.human_readable_price : displayPrice}
      </div>
      <div className={styles.buyContainer}>
        <div className={styles.buy}>
          <Button size={'lg'} disabled={Boolean(selectedPrice) && isBusy} onClick={onSubmit}>
            {userAlreadyHasCategoryProduct ? t('Manage') : t('Buy now')}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <tr className={styles.row}>
      <td className={styles.productName}>
        {displayName}
        {description && <p className={styles.description}>{description}</p>}
        <div className={styles.mobileView}>{priceTableCells}</div>
      </td>
      <td className={styles.price}>
        <div className={styles.oneTime}>
          <KoboSelect3
            size={'fit'}
            name='products'
            options={products.map((product) => {
              return { value: product.id, label: product.name }
            })}
            onChange={(productId) => onChangeProduct(productId as string)}
            value={selectedProduct.id}
          />
          {displayName === 'File Storage' && (
            <KoboSelect3
              size={'fit'}
              name={t('prices')}
              options={priceOptions}
              onChange={onChangePrice}
              value={selectedPrice.id}
            />
          )}
        </div>
      </td>
      <td className={styles.fullScreen}>{priceTableCells}</td>
    </tr>
  )
}
