/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { AllKeysPanel } from './components/all-keys-panel'
import { MyContributionPanel } from './components/my-contribution-panel'
import { SettingsPanel } from './components/settings-panel'

type TabValue = 'mine' | 'all' | 'settings'

export function ContributedKeys() {
  const { t } = useTranslation()
  const role = useAuthStore((state) => state.auth.user?.role ?? 0)
  const [tab, setTab] = useState<TabValue>('mine')

  const tabs = useMemo(() => {
    const list: { value: TabValue; label: string }[] = [
      { value: 'mine', label: t('My contribution') },
    ]
    if (role >= ROLE.ADMIN) {
      list.push({ value: 'all', label: t('All keys') })
    }
    if (role >= ROLE.SUPER_ADMIN) {
      list.push({ value: 'settings', label: t('Settings') })
    }
    return list
  }, [role, t])

  const activeTab = tabs.some((item) => item.value === tab) ? tab : 'mine'

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Contribute Upstream Key')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setTab(value as TabValue)}
          className='mx-auto w-full max-w-6xl'
        >
          <TabsList className='w-fit'>
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value='mine' className='pt-2'>
            <MyContributionPanel />
          </TabsContent>
          {role >= ROLE.ADMIN ? (
            <TabsContent value='all' className='pt-2'>
              <AllKeysPanel />
            </TabsContent>
          ) : null}
          {role >= ROLE.SUPER_ADMIN ? (
            <TabsContent value='settings' className='pt-2'>
              <SettingsPanel />
            </TabsContent>
          ) : null}
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
