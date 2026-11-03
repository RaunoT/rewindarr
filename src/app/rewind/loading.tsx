import SkeletonLine from '@/components/SkeletonLine'

// Laid out like the opening story, with the progress bar and the story
// buttons where they will be, so the centred welcome doesn't move
export default function Loading() {
  return (
    <div className='relative flex flex-1 flex-col'>
      <div className='absolute -top-2 right-0 left-0 py-2'>
        <div className='skeleton h-1' />
      </div>
      <div className='w-full flex-1 pt-8 sm:flex sm:flex-col sm:justify-center'>
        <div className='skeleton mb-8 size-24' />
        {/* The welcome takes a line more on phones */}
        <div className='text-3xl leading-tight sm:text-4xl'>
          <SkeletonLine width='w-10/12' />
          <SkeletonLine width='w-7/12' />
          <SkeletonLine className='sm:hidden' width='w-9/12' />
        </div>
      </div>
      {/* Previous and next */}
      <div className='mt-4 flex'>
        <div className='skeleton h-10 w-[74px]' />
      </div>
    </div>
  )
}
