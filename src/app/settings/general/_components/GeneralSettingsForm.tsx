'use client'

import audienceFreshSvg from '@/assets/rotten-tomatoes/audience-fresh.svg'
import freshSvg from '@/assets/rotten-tomatoes/fresh.svg'
import Avatar from '@/components/Avatar'
import { STAT_ICONS } from '@/components/icons'
import MediaServerLogo from '@/components/MediaItem/MediaServerLogo'
import SeerrLogo from '@/components/MediaItem/SeerrLogo'
import SiteLogo from '@/components/MediaItem/SiteLogo'
import MultiSelect from '@/components/MultiSelect'
import SourceUnreachable from '@/components/SourceUnreachable'
import StatusMessage from '@/components/StatusMessage'
import {
  GeneralSettings,
  PublicSettings,
  SettingsFormInitialState,
} from '@/types/settings'
import { TautulliLibrary } from '@/types/tautulli'
import {
  APP_NAME,
  EXTERNAL_LINK_NAMES,
  EXTERNAL_LINKS,
} from '@/utils/constants'
import { sortByLabel } from '@/utils/helpers'
import { getMediaServerName } from '@/utils/mediaServerName'
import { PlayIcon, RectangleStackIcon } from '@heroicons/react/24/outline'
import { kebabCase } from 'lodash'
import { Reorder } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { useActionState, useEffect, useRef, useState } from 'react'
import { CheckboxGroup, Label, Switch } from 'react-aria-components'
import SettingsForm from '../../_components/SettingsForm'
import saveGeneralSettings from '../_actions/updateGeneralSettings'
import SortableLibrary from './SortableLibrary'

type Props = {
  settings: PublicSettings
  // Null when the source can't be reached
  libraries: TautulliLibrary[] | null
  users: { user_id: string; friendly_name: string; avatar: string }[]
}

type GeneralFormState = SettingsFormInitialState<GeneralSettings>

export default function GeneralSettingsForm({
  settings,
  libraries: sourceLibraries,
  users,
}: Props) {
  const isSourceReachable = sourceLibraries !== null
  const libraries = sourceLibraries ?? []
  // Saving without the library list would clear the chosen libraries
  const hasLibraries = libraries.length > 0
  const [librariesState, setLibrariesState] = useState<TautulliLibrary[]>(
    () => {
      const activeLibraries = settings.general.activeLibraries
        .map((libName) =>
          libraries.find((lib) => kebabCase(lib.section_name) === libName),
        )
        .filter((lib): lib is TautulliLibrary => !!lib)
      const inactiveLibraries = libraries.filter(
        (lib) =>
          !settings.general.activeLibraries.includes(
            kebabCase(lib.section_name),
          ),
      )

      return [...activeLibraries, ...inactiveLibraries]
    },
  )
  const [moveAnnouncement, setMoveAnnouncement] = useState<string>('')
  const librariesRef = useRef<HTMLDivElement>(null)
  const focusAfterMoveRef = useRef<string | null>(null)
  const t = useTranslations('Settings.General')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const { isSeerrActive, mediaServerType } = settings.connection
  const mediaServerName = getMediaServerName(mediaServerType)
  const linkOptions = sortByLabel(
    [
      {
        value: 'mediaServer',
        label: mediaServerName,
        icon: <MediaServerLogo type={mediaServerType} />,
      },
      ...(isSeerrActive
        ? [
            { value: 'seerr', label: 'Seerr', icon: <SeerrLogo /> },
            {
              value: 'seerrStatus',
              label: t('seerrStatus'),
              icon: <SeerrLogo />,
            },
          ]
        : []),
      ...EXTERNAL_LINKS.map((site) => ({
        value: site,
        label: EXTERNAL_LINK_NAMES[site],
        icon: <SiteLogo site={site} />,
      })),
    ],
    locale,
  )
  // The server's own statistics first, then the rating sites'
  const itemStatisticOptions = [
    { value: 'year', label: tCommon('year'), icon: <STAT_ICONS.year /> },
    {
      value: 'duration',
      label: tCommon('duration'),
      icon: <STAT_ICONS.duration />,
    },
    { value: 'plays', label: tCommon('plays'), icon: <PlayIcon /> },
    { value: 'users', label: tCommon('users'), icon: <STAT_ICONS.users /> },
    ...(isSeerrActive
      ? [
          {
            value: 'requests',
            label: tCommon('requests'),
            icon: <STAT_ICONS.requests />,
          },
        ]
      : []),
    {
      value: 'tmdbRating',
      label: tCommon('ratingBy', { provider: 'TMDB' }),
      icon: <SiteLogo site='tmdb' />,
    },
    {
      value: 'imdbRating',
      label: tCommon('ratingBy', { provider: 'IMDb' }),
      icon: <SiteLogo site='imdb' />,
    },
    {
      value: 'rottenTomatoesRating',
      label: tCommon('rottenTomatoesCritics'),
      icon: <Image src={freshSvg} alt='' />,
    },
    {
      value: 'rottenTomatoesAudienceRating',
      label: tCommon('rottenTomatoesAudience'),
      icon: <Image src={audienceFreshSvg} alt='' />,
    },
  ]
  const userOptions = sortByLabel(
    users.map((user) => ({
      value: String(user.user_id),
      label: user.friendly_name,
      icon: (
        <span className='option-avatar'>
          <Avatar src={user.avatar} name={user.friendly_name} sizes='1.5rem' />
        </span>
      ),
    })),
    locale,
  )
  const initialState: GeneralFormState = {
    message: '',
    status: '',
    fields: {
      ...settings.general,
    },
  }
  const [formState, formAction] = useActionState<GeneralFormState, FormData>(
    saveGeneralSettings,
    initialState,
  )
  const generalSettings = {
    ...settings.general,
    ...formState.fields,
  }

  useEffect(() => {
    const focusTarget = focusAfterMoveRef.current

    if (focusTarget) {
      focusAfterMoveRef.current = null
      librariesRef.current
        ?.querySelector<HTMLButtonElement>(`[data-move='${focusTarget}']`)
        ?.focus()
    }
  }, [librariesState])

  function handleSortEnd() {
    setMoveAnnouncement('')
    librariesRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function moveLibrary(index: number, offset: -1 | 1) {
    const target = index + offset

    if (target < 0 || target >= librariesState.length) {
      return
    }

    const next = [...librariesState]
    const [moved] = next.splice(index, 1)
    const isAtEdge = target === 0 || target === next.length
    const direction = offset === -1 ? 'up' : 'down'

    next.splice(target, 0, moved)
    focusAfterMoveRef.current = `${moved.section_id}-${
      isAtEdge ? (direction === 'up' ? 'down' : 'up') : direction
    }`
    setLibrariesState(next)
    setMoveAnnouncement(
      t('movedTo', {
        name: moved.section_name,
        position: target + 1,
        total: next.length,
      }),
    )
  }

  return (
    <SettingsForm
      formState={formState}
      formAction={formAction}
      hideSubmit={!hasLibraries}
      isSetup={!generalSettings.complete}
    >
      <section className='group-settings group'>
        <h2 className='heading-settings'>{t('config')}</h2>
        <label className='input-wrapper'>
          <input
            key={`server-name-${generalSettings.serverName}`}
            type='text'
            className='input'
            name='serverName'
            defaultValue={generalSettings.serverName}
            placeholder={APP_NAME}
          />
          <span className='label'>
            <span className='label-wrapper'>{t('serverName')}</span>
          </span>
        </label>
      </section>
      <section className='group-settings group'>
        <h2 className='heading-settings'>{t('libraries')}</h2>
        {!isSourceReachable ? (
          <SourceUnreachable
            source={settings.connection.statisticsSource}
            as='h3'
            isAdmin
            isInCard
          />
        ) : hasLibraries ? (
          <CheckboxGroup
            key={`active-libraries-${generalSettings.activeLibraries.join(',')}`}
            ref={librariesRef}
            className='input-wrapper'
            name='activeLibraries'
            defaultValue={generalSettings.activeLibraries}
          >
            <Reorder.Group
              as='div'
              axis='y'
              values={librariesState}
              onReorder={setLibrariesState}
              className='peer mr-auto flex flex-col gap-2'
            >
              {librariesState.map((library, index) => (
                <SortableLibrary
                  key={`library-${library.section_id}`}
                  library={library}
                  isFirst={index === 0}
                  isLast={index === librariesState.length - 1}
                  onMove={(offset) => moveLibrary(index, offset)}
                  onDragEnd={handleSortEnd}
                />
              ))}
            </Reorder.Group>
            <p aria-live='polite' role='status' className='sr-only'>
              {moveAnnouncement}
            </p>
            <Label className='label label--start'>
              <span className='label-wrapper'>{t('activeLibraries')}</span>
            </Label>
          </CheckboxGroup>
        ) : (
          <StatusMessage
            icon={RectangleStackIcon}
            title={t('noLibrariesMessage1')}
            description={t('noLibrariesMessage2')}
            as='h3'
            isInCard
          />
        )}
      </section>
      {hasLibraries && (
        <>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{t('media')}</h2>
            <Switch
              key={`posters-tmdb-${generalSettings.isPostersTmdbOnly}`}
              className='switch'
              name='isPostersTmdbOnly'
              defaultSelected={generalSettings.isPostersTmdbOnly}
            >
              <div className='indicator'></div>
              <span className='label'>
                <span className='label-wrapper'>{t('tmdbOnlyPosters')}</span>
              </span>
            </Switch>
            <MultiSelect
              key={`links-${generalSettings.activeExternalLinks.join(',')}`}
              label={t('links')}
              description={t(
                isSeerrActive ? 'linksDescriptionSeerr' : 'linksDescription',
                { server: mediaServerName },
              )}
              name='activeExternalLinks'
              options={linkOptions}
              defaultValue={generalSettings.activeExternalLinks}
              placeholder={tCommon('none')}
            />
            <MultiSelect
              key={`item-stats-${generalSettings.activeItemStatistics.join(
                ',',
              )}`}
              label={t('itemStatistics')}
              description={t('itemStatisticsDescription')}
              name='activeItemStatistics'
              options={itemStatisticOptions}
              defaultValue={generalSettings.activeItemStatistics}
              placeholder={tCommon('none')}
            />
            <label className='input-wrapper'>
              <input
                key={`min-play-percent-${generalSettings.minPlayPercent}`}
                type='number'
                className='input'
                name='minPlayPercent'
                defaultValue={generalSettings.minPlayPercent}
                placeholder='50'
                min='0'
                max='100'
                required
              />
              <span className='label'>
                <span className='label-wrapper'>{t('minPlayPercent')}</span>
                <small>{t('minPlayPercentDescription')}</small>
              </span>
            </label>
          </section>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{t('privacy')}</h2>
            {users.length > 0 ? (
              <MultiSelect
                key={`excluded-users-${generalSettings.excludedUsers.join(',')}`}
                label={t('excludedUsers')}
                name='excludedUsers'
                options={userOptions}
                defaultValue={generalSettings.excludedUsers}
                placeholder={tCommon('none')}
              />
            ) : (
              // Preserve saved exclusions when the user list can't be loaded so
              // submitting the form doesn't silently clear them.
              generalSettings.excludedUsers.map((userId) => (
                <input
                  key={`excluded-user-${userId}`}
                  type='hidden'
                  name='excludedUsers'
                  value={userId}
                />
              ))
            )}
            <Switch
              key={`outside-access-${generalSettings.isOutsideAccess}`}
              className='switch items-start'
              name='isOutsideAccess'
              defaultSelected={generalSettings.isOutsideAccess}
            >
              <div className='indicator'></div>
              <span className='label'>
                <span className='label-wrapper'>{t('outsideAccess')}</span>
                <small>{t('outsideAccessDescription')}</small>
              </span>
            </Switch>
            <Switch
              key={`anonymized-${generalSettings.isAnonymized}`}
              className='switch'
              name='isAnonymized'
              defaultSelected={generalSettings.isAnonymized}
            >
              <div className='indicator'></div>
              <span className='label'>
                <span className='label-wrapper'>{t('anonymizeUsers')}</span>
              </span>
            </Switch>
          </section>
          <section className='group-settings group'>
            <h2 className='heading-settings'>{t('analytics')}</h2>
            <label className='input-wrapper'>
              <input
                key={`analytics-id-${generalSettings.googleAnalyticsId}`}
                type='text'
                className='input'
                name='googleAnalyticsId'
                defaultValue={generalSettings.googleAnalyticsId}
                placeholder='G-XXXXXXXXXX'
              />
              <span className='label'>
                {/* eslint-disable-next-line react/jsx-no-literals */}
                <span className='label-wrapper'>Google Analytics ID</span>
              </span>
            </label>
          </section>
        </>
      )}
    </SettingsForm>
  )
}
