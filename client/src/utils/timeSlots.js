export const getSlotVoteCount = slot => slot.votes?.length ?? slot._count?.votes ?? 0;

export const rankTimeSlots = slots => [...slots].sort((a, b) =>
  getSlotVoteCount(b) - getSlotVoteCount(a)
  || a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

export const getSlotRegistrations = (votes, slotId) => votes.filter(vote =>
  vote.status === 'JOIN' && (slotId === 'unassigned'
    ? !vote.timeSlotVotes?.length
    : vote.timeSlotVotes?.some(item => item.timeSlotId === slotId)));
