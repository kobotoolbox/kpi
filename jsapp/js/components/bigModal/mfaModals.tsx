import './mfaModals.scss'

import React, { useEffect, useState } from 'react'

import { observer } from 'mobx-react-lite'
import QRCode from 'react-qr-code'
import {
  MfaRejection,
  useIsPasswordNeeded,
  useMfaActivate,
  useMfaConfirmCode,
  useMfaDeactivate,
  useMfaRegenerateCodes,
} from '#/account/security/mfa/mfa.api'
import bem, { makeBem } from '#/bem'
import PasswordInput from '#/components/common/PasswordInput'
import TextInput from '#/components/common/TextInput'
import Button from '#/components/common/button'
import envStore from '#/envStore'
import profileStore from '#/stores/profile'

bem.MFAModal = makeBem(null, 'mfa-modal')

bem.MFAModal__p = makeBem(bem.MFAModal, 'p', 'div')

bem.MFAModal__title = makeBem(bem.MFAModal, 'title', 'h4')
bem.MFAModal__description = makeBem(bem.MFAModal, 'description')

bem.MFAModal__body = makeBem(bem.MFAModal, 'body')
bem.MFAModal__helpLink = makeBem(bem.MFAModal, 'help-link', 'a')
bem.MFAModal__qrcodeWrapper = makeBem(bem.MFAModal, 'qrcode-wrapper')
bem.MFAModal__codes = makeBem(bem.MFAModal, 'codes')
bem.MFAModal__codesWrapper = makeBem(bem.MFAModal, 'codes-wrapper')
bem.MFAModal__list = makeBem(bem.MFAModal, 'list', 'ul')

bem.MFAModal__footer = makeBem(bem.MFAModal, 'footer', 'footer')
bem.MFAModal__footerLeft = makeBem(bem.MFAModal, 'footer-left')
bem.MFAModal__footerRight = makeBem(bem.MFAModal, 'footer-right')

type ModalSteps = 'backups' | 'disclaimer' | 'help' | 'manual' | 'qr' | 'token'

/** Which job these steps are doing, set by whoever opened the modal. */
export type MfaModalType = 'deactivate' | 'qr' | 'reconfigure' | 'regenerate'

interface MFAModalsProps {
  onModalClose: Function
  qrCode?: string
  modalType: MfaModalType
}

function getInitialModalStep(modalType: MfaModalType): ModalSteps {
  switch (modalType) {
    case 'qr':
      return 'qr'
    case 'regenerate':
    case 'reconfigure':
      return 'disclaimer'
    case 'deactivate':
      return 'token'
  }
}

/**
 * Pulls the secret out of the `otpauth://` URI, for typing it in by hand. Runs during render, so an unreadable URI
 * leaves a message rather than blanking the modal.
 */
function getSecretKey(totpUrl: string | null): string {
  let secret: string | null = null
  try {
    secret = totpUrl ? new URL(totpUrl).searchParams.get('secret') : null
  } catch {
    secret = null
  }
  return secret ?? t('Could not generate secret key')
}

/** `envStore` supplies the code length and help text, hence the `observer` export. */
function MFAModals(props: MFAModalsProps) {
  const [currentStep, setCurrentStep] = useState<ModalSteps>(() => getInitialModalStep(props.modalType))
  const [qrCode, setQrCode] = useState<string | null>(props.qrCode || null)
  /** Currently input code, used for every call that asks for one */
  const [inputString, setInputString] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [isDownloadClicked, setIsDownloadClicked] = useState(false)
  const [errorText, setErrorText] = useState<string | undefined>(undefined)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined)

  const isPasswordNeeded = useIsPasswordNeeded()
  const activate = useMfaActivate()
  const confirmCode = useMfaConfirmCode()
  const deactivate = useMfaDeactivate()
  const regenerateCodes = useMfaRegenerateCodes()

  const isBusy = activate.isPending || confirmCode.isPending || deactivate.isPending || regenerateCodes.isPending

  // HACK FIX: the close icon belongs to the modal frame, and the codes are shown once - dismissing would lose them.
  useEffect(() => {
    if (currentStep !== 'backups') {
      return
    }
    const closeIcon = document.getElementsByClassName('modal__x')[0] as HTMLElement | undefined
    if (closeIcon) {
      closeIcon.hidden = true
    }
  }, [currentStep])

  function closeModal() {
    props.onModalClose()
  }

  function showCodes(codes: string[]) {
    setBackupCodes(codes)
    setCurrentStep('backups')
  }

  function clearErrors() {
    setErrorText(undefined)
    setPasswordError(undefined)
  }

  /** A refused credential shows by its field; anything else is left to the usual error toast. */
  function onCredentialRejected(error: Error) {
    if (!(error instanceof MfaRejection)) {
      return
    }
    if (error.field === 'password') {
      setPasswordError(error.message)
    } else if (error.field === 'code') {
      setErrorText(error.message)
    }
  }

  function mfaConfirm() {
    clearErrors()
    confirmCode.mutate(
      { code: inputString, password: isPasswordNeeded ? password : undefined },
      { onSuccess: showCodes, onError: onCredentialRejected },
    )
  }

  // TODO: DEV-1971 this and the regenerate below stop asking for a code.
  function mfaDeactivate() {
    clearErrors()
    deactivate.mutate(
      { code: inputString },
      {
        onSuccess: () => {
          // Reconfiguring is a deactivation plus a fresh setup, so the modal walks on to the new QR code itself.
          if (props.modalType === 'reconfigure') {
            activate.mutate(undefined, {
              onSuccess: ({ qrCodeUrl }) => {
                setQrCode(qrCodeUrl)
                setCurrentStep('qr')
              },
            })
          } else {
            closeModal()
          }
        },
        onError: onCredentialRejected,
      },
    )
  }

  function mfaRegenerate() {
    clearErrors()
    regenerateCodes.mutate({ code: inputString }, { onSuccess: showCodes, onError: onCredentialRejected })
  }

  function onSubmit() {
    setInputString('')

    switch (props.modalType) {
      case 'regenerate':
        mfaRegenerate()
        break
      case 'reconfigure':
      case 'deactivate':
        mfaDeactivate()
        break
    }
  }

  function changeStep(evt: React.ChangeEvent<HTMLInputElement>, newStep: ModalSteps) {
    evt.preventDefault()
    setCurrentStep(newStep)
  }

  function isTokenValid() {
    return inputString.length >= 1
  }

  function downloadCodes() {
    if (!backupCodes) {
      return
    }

    const USERNAME = profileStore.currentAccount.username
    // gets date in yyyymmdd
    const DATE = new Date().toJSON().slice(0, 10).replace(/-/g, '')

    const formatedCodes = backupCodes.map((code) => code + '\n')
    const codesLink = document.createElement('a')
    const codesFile = new Blob(formatedCodes)

    codesLink.href = URL.createObjectURL(codesFile)
    codesLink.download = 'backups_' + USERNAME + '_' + DATE + '.txt'

    document.body.appendChild(codesLink)
    codesLink.click()

    setIsDownloadClicked(true)
  }

  function renderIntroText() {
    return (
      <bem.MFAModal__p>
        {t(
          'Two-factor authentication (2FA) verifies your identity using an authenticator application in addition to your usual password. ' +
            'We recommend enabling two-factor authentication for an additional layer of protection.',
        )}
      </bem.MFAModal__p>
    )
  }

  /** The field is the same on all three steps that ask for a code. */
  function renderCodeInput() {
    return (
      <bem.MFAModal__p>
        <TextInput
          className='mfa-modals-textbox'
          size='lg'
          error={errorText}
          value={inputString}
          onChange={(evt) => setInputString(evt.currentTarget.value)}
          // Keeps password managers from filling it in as the username for the password field below
          autoComplete='one-time-code'
        />
      </bem.MFAModal__p>
    )
  }

  /**
   * allauth wants a recent password before turning 2FA on. We ask here instead of relying on the reauthentication
   * redirect: leaving the page closes this modal, and starting over makes a new secret, so the one already scanned
   * stops working. Sending both together also means neither expires while the other is typed.
   */
  function renderPasswordInput() {
    if (!isPasswordNeeded) {
      return null
    }
    return (
      <bem.MFAModal__p>
        <PasswordInput
          label={t('Password')}
          description={t('Confirm your password to turn on two-factor authentication')}
          size='lg'
          error={passwordError}
          value={password}
          onChange={(evt) => setPassword(evt.currentTarget.value)}
          autoComplete='current-password'
        />
      </bem.MFAModal__p>
    )
  }

  /** The confirming steps need the password too, when there is one */
  function isConfirmValid() {
    return isTokenValid() && (!isPasswordNeeded || password.length >= 1)
  }

  function renderQRCodeStep() {
    return (
      <bem.MFAModal m='step-qr'>
        <bem.MFAModal__description>
          {renderIntroText()}
          <bem.MFAModal__p>
            <strong>
              {t('Scan QR code and enter the ##number##-digit token from the application').replace(
                '##number##',
                String(envStore.data.mfa_code_length),
              )}
            </strong>
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          <bem.MFAModal__qrcodeWrapper>
            <QRCode value={qrCode || ''} size={170} />
          </bem.MFAModal__qrcodeWrapper>

          <bem.MFAModal__p>
            {t(
              'After scanning the QR code image, the authenticator app will display a ##number##-digit code that you can enter below.',
            ).replace('##number##', String(envStore.data.mfa_code_length))}
          </bem.MFAModal__p>

          {renderCodeInput()}
          {renderPasswordInput()}

          <bem.MFAModal__p m='align-right'>
            {t('No QR code?')}
            &nbsp;
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                changeStep(evt, 'manual')
              }}
            >
              {t('Enter key manually')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={mfaConfirm}
              isDisabled={!isConfirmValid()}
              isPending={isBusy}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    )
  }

  function renderBackupStep() {
    return (
      <bem.MFAModal m='step-backup'>
        <bem.MFAModal__description>
          <bem.MFAModal__p>
            {t(
              'The following recovery codes will help you access your account in case your authenticator app fails. These codes are unique and will not be stored in your Kobo account. ' +
                'This is your only opportunity to save them. Please download the file and keep it somewhere safe.',
            )}
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          {backupCodes && (
            <bem.MFAModal__codesWrapper>
              <bem.MFAModal__codes>
                <bem.MFAModal__list>
                  {backupCodes.map((backupCode, index) => (
                    <li key={index}>
                      <strong>{backupCode}</strong>
                    </li>
                  ))}
                </bem.MFAModal__list>
              </bem.MFAModal__codes>
            </bem.MFAModal__codesWrapper>
          )}
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerLeft>
            <Button type='secondary' size='l' isFullWidth label={t('Download codes')} onClick={downloadCodes} />
          </bem.MFAModal__footerLeft>

          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('I saved my codes')}
              onClick={closeModal}
              isDisabled={!isDownloadClicked}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    )
  }

  function renderManualStep() {
    return (
      <bem.MFAModal m='step-manual'>
        <bem.MFAModal__description>
          <bem.MFAModal__p>{renderIntroText()}</bem.MFAModal__p>

          <bem.MFAModal__p>
            <strong>
              {t('Enter this key into your authenticator app to generate a ##number##-digit token').replace(
                '##number##',
                String(envStore.data.mfa_code_length),
              )}
            </strong>
          </bem.MFAModal__p>
        </bem.MFAModal__description>

        <bem.MFAModal__body>
          <bem.MFAModal__codesWrapper>
            <bem.MFAModal__codes>{getSecretKey(qrCode)}</bem.MFAModal__codes>
          </bem.MFAModal__codesWrapper>

          <bem.MFAModal__p>
            {t(
              'Once your authenticator app is set up, generate a ##number##-digit token and enter it in the field below.',
            ).replace('##number##', String(envStore.data.mfa_code_length))}
          </bem.MFAModal__p>

          {renderCodeInput()}
          {renderPasswordInput()}

          <bem.MFAModal__p m='align-right'>
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                changeStep(evt, 'qr')
              }}
            >
              {t('Take me back to QR code')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={mfaConfirm}
              isDisabled={!isConfirmValid()}
              isPending={isBusy}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    )
  }

  function renderTokenStep() {
    return (
      <bem.MFAModal m='step-token'>
        <bem.MFAModal__body>
          <bem.MFAModal__p>
            <strong>
              {/*This is safe as this step only shows if not on qr step*/}
              {props.modalType === 'regenerate' &&
                t(
                  'Please enter your ##number##-digit authenticator token or one of your recovery codes to regenerate your backup codes.',
                ).replace('##number##', String(envStore.data.mfa_code_length))}
              {props.modalType !== 'regenerate' &&
                t(
                  'Please enter your ##number##-digit authenticator token or one of your recovery codes to deactivate two-factor authentication.',
                ).replace('##number##', String(envStore.data.mfa_code_length))}
            </strong>
          </bem.MFAModal__p>

          {renderCodeInput()}

          <bem.MFAModal__p m='align-right'>
            <bem.MFAModal__helpLink
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                changeStep(evt, 'help')
              }}
            >
              {t('Problems with your token?')}
            </bem.MFAModal__helpLink>
          </bem.MFAModal__p>
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={onSubmit}
              isDisabled={!isTokenValid()}
              isPending={isBusy}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    )
  }

  function renderDisclaimerStep() {
    return (
      <bem.MFAModal
        m={{
          regenerate: props.modalType === 'regenerate',
          disclaimer: true,
        }}
      >
        <bem.MFAModal__body>
          <bem.MFAModal__p>
            <strong>
              {/*This is safe as this step only shows if on reconfigure or regenerate*/}
              {props.modalType === 'regenerate' &&
                t('Please note that generating new recovery codes will invalidate any previously generated codes.')}

              {props.modalType !== 'regenerate' &&
                t(
                  'Please note that in order to reconfigure two-factor authentication (2FA), the previous set up will first be deleted. Tokens or recovery codes from the previous set up will not be valid anymore.',
                )}
            </strong>
          </bem.MFAModal__p>

          {props.modalType === 'reconfigure' && (
            <bem.MFAModal__p>
              {t(
                "Once your current 2FA has been deactivated, you'll be prompted to configure it again. If you cannot complete the process, 2FA will remain disabled for your account. " +
                  'In this case, you can enable it again at any time through the usual process.',
              )}
            </bem.MFAModal__p>
          )}
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerRight>
            <Button
              type='primary'
              size='l'
              isFullWidth
              label={t('Next')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                changeStep(evt, 'token')
              }}
            />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    )
  }

  function renderHelpStep() {
    return (
      <bem.MFAModal m='step-help'>
        <bem.MFAModal__body>
          <bem.MFAModal__p>
            <strong>{t('Issues with the token')}</strong>
          </bem.MFAModal__p>

          <bem.MFAModal__p
            dangerouslySetInnerHTML={{
              __html: envStore.data.mfa_localized_help_text,
            }}
          />
        </bem.MFAModal__body>

        <bem.MFAModal__footer>
          <bem.MFAModal__footerLeft>
            <Button
              type='secondary'
              size='l'
              isFullWidth
              label={t('Back')}
              onClick={(evt: React.ChangeEvent<HTMLInputElement>) => {
                changeStep(evt, 'token')
              }}
            />
          </bem.MFAModal__footerLeft>

          <bem.MFAModal__footerRight>
            <Button type='primary' size='l' isFullWidth label={t('OK')} onClick={closeModal} />
          </bem.MFAModal__footerRight>
        </bem.MFAModal__footer>
      </bem.MFAModal>
    )
  }

  // qrCode is mandatory if modalType is qr
  if (!props.qrCode && props.modalType === 'qr') {
    throw new Error('Modal is expecting a qr code but did not recieve any')
  }

  switch (currentStep) {
    case 'qr':
      return renderQRCodeStep()
    case 'backups':
      return renderBackupStep()
    case 'manual':
      return renderManualStep()
    case 'token':
      return renderTokenStep()
    case 'disclaimer':
      return renderDisclaimerStep()
    case 'help':
      return renderHelpStep()
    default:
      return null
  }
}

export default observer(MFAModals)
