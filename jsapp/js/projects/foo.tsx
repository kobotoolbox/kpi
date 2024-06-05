import React, {useState} from 'react';
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';

export default function Foo() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedOption, selectOption] = useState<string | null>('b');

  return (
    <>
      <Button
        size='m'
        type='full'
        label={t('Open foo modal')}
        color='red'
        startIcon='help'
        onClick={() => setIsModalOpen(true)}
      />

      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => {
          setIsModalOpen(false);
        }}
      >
        <KoboModalHeader>Foo modal</KoboModalHeader>

        <div style={{padding: '20px 30px 0'}}>
          <KoboSelect
            label='Choose option…'
            name='foo'
            type='outline'
            size='m'
            options={[
              {value: 'a', label: 'Option A'},
              {value: 'b', label: 'Option B'},
              {value: 'c', label: 'Option C'},
              {value: 'd', label: 'Option D'},
              {value: 'e', label: 'Option E'},
              {value: 'f', label: 'Option F'},
            ]}
            selectedOption={selectedOption}
            onChange={selectOption}
          />
        </div>

        <KoboModalFooter>
          <Button
            size='m'
            type='frame'
            label={t('Done')}
            color='storm'
            onClick={() => setIsModalOpen(false)}
          />
        </KoboModalFooter>
      </KoboModal>
    </>
  );
}
