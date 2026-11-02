'use client'

import CardWrapper from '@/app/_components/CardWrapper'
import RouteError, { RouteErrorProps } from '@/components/RouteError'
import SkeletonSized from '@/components/SkeletonSized'
import HistorySkeleton from './_components/HistorySkeleton'

export default function Error(props: RouteErrorProps) {
  return (
    <CardWrapper>
      <SkeletonSized skeleton={<HistorySkeleton />}>
        <RouteError {...props} logPrefix='HISTORY' isInCard />
      </SkeletonSized>
    </CardWrapper>
  )
}
