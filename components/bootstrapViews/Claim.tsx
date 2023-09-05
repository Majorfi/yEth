import React, {useCallback, useEffect, useMemo, useState} from 'react';
import useBootstrap from 'contexts/useBootstrap';
import {useTimer} from 'hooks/useTimer';
import BOOTSTRAP_ABI from 'utils/abi/bootstrap.abi';
import {multicall} from 'utils/actions';
import {encodeFunctionData} from 'viem';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Modal} from '@yearn-finance/web-lib/components/Modal';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {TTokenInfo} from 'contexts/useTokenList';
import type {ReactElement} from 'react';
import type {Hex} from 'viem';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {TTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';

type TClaimDetails = {
	id: string,
	protocolName: string,
	value: number,
	amount: TNormalizedBN,
	token: TTokenInfo,
	isSelected: boolean,
	multicall: {target: TAddress, callData: Hex}
}
function ClaimConfirmationModal({claimableIncentive, onUpdateIncentive, onSuccess, onCancel}: {
	claimableIncentive: TClaimDetails[],
	onUpdateIncentive: (id: string, isSelected: boolean) => void,
	onSuccess: VoidFunction,
	onCancel: VoidFunction
}): ReactElement {
	const {provider} = useWeb3();
	const [claimStatus, set_claimStatus] = useState<TTxStatus>(defaultTxStatus);
	const hasSelected = useMemo((): boolean => claimableIncentive.some((incentive): boolean => incentive.isSelected), [claimableIncentive]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Group, for each protocol, the list of incentives you can claim.
	**
	** @deps: claimableIncentive - the list of all claimable incentives.
	** @returns: {protocolName: [incentives]} - a dictionary of protocolName to incentives.
	**********************************************************************************************/
	const claimableIncentiveByProtocol = useMemo((): TDict<TClaimDetails[]> => {
		const result: TDict<TClaimDetails[]> = {};
		claimableIncentive.forEach((incentive): void => {
			const protocol = incentive.protocolName;
			if (!result[protocol]) {
				result[protocol] = [];
			}
			result[protocol].push(incentive);
		});
		return result;
	}, [claimableIncentive]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Calculate the total amount of incentives you asked to claim, excluding the one you didn't
	** select.
	**
	** @deps: claimableIncentive - the list of all claimable incentives.
	** @returns: number - the total amount of incentives you asked to claim.
	**********************************************************************************************/
	const totalToClaim = useMemo((): number => (
		claimableIncentive
			.filter((incentive): boolean => incentive.isSelected)
			.reduce((total, incentive): number => total + incentive.value, 0)
	), [claimableIncentive]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Web3 actions to claim the incentives you selected. This is triggered via a multicall3.
	**********************************************************************************************/
	async function onClaim(): Promise<void> {
		const result = await multicall({
			connector: provider,
			contractAddress: toAddress(process.env.BOOTSTRAP_ADDRESS),
			multicallData: (
				claimableIncentive
					.filter((incentive): boolean => incentive.isSelected)
					.map((incentive): {target: TAddress, callData: Hex} => incentive.multicall)
			),
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			onSuccess();
		}
	}

	return (
		<div className={'w-full max-w-[400px] rounded-sm bg-neutral-0 py-6'}>
			<b className={'px-6 text-xl'}>{'Confirm claim'}</b>
			<div className={'mt-8 grid grid-cols-1 gap-4'}>
				<div className={'grid grid-cols-3 gap-4 px-6'}>
					<small className={'text-xs text-neutral-500'}>{'Token'}</small>
					<small className={'text-right text-xs text-neutral-500'}>{'Amount'}</small>
					<small className={'text-right text-xs text-neutral-500'}>{'Value, USD'}</small>
				</div>
				<div className={'scrollbar-show max-h-[400px] overflow-y-scroll border-y border-neutral-200 bg-neutral-100/60'}>
					<div className={'grid grid-cols-1 gap-4 px-6 py-4'}>
						{Object.values(claimableIncentiveByProtocol).map((protocol): ReactElement => {
							return (
								<div key={protocol[0].protocolName}>
									<p className={'mb-1 border-b border-neutral-300 pb-1 font-bold text-neutral-900'}>
										{protocol[0].protocolName}
									</p>
									{
										protocol.map((incentive): ReactElement => (
											<div
												key={incentive.id}
												className={'grid grid-cols-3 gap-4'}>
												<label className={'flex cursor-pointer items-center'}>
													<input
														onChange={(e): void => onUpdateIncentive(incentive.id, e.target.checked)}
														checked={incentive.isSelected}
														type={'checkbox'}
														className={'focus:ring-purple-300 mr-2 h-3 w-3 rounded-sm border-0 border-neutral-400 bg-neutral-200 text-purple-300 indeterminate:ring-2 focus:bg-neutral-200 focus:ring-2 focus:ring-offset-neutral-100'} />
													<p>{incentive.token.symbol || truncateHex(incentive.token.address, 6)}</p>
												</label>
												<b className={'text-right'}>
													{formatAmount(incentive.amount.normalized, 6, 6)}
												</b>
												<b className={'text-right'}>
													{`$${formatAmount(incentive.value, 2, 2)}`}
												</b>
											</div>
										))
									}
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<div className={'mt-20 px-6'}>
				<Button
					onClick={onClaim}
					isBusy={claimStatus.pending}
					isDisabled={!hasSelected || !provider}
					className={'yearn--button w-full rounded-md !text-sm'}>
					{`Claim ${formatAmount(totalToClaim, 6, 6)}`}
				</Button>
				<button
					onClick={onCancel}
					className={'mt-2 h-10 w-full text-center text-neutral-500 transition-colors hover:text-neutral-900'}>
					{'Cancel'}
				</button>
			</div>
		</div>
	);
}

function Timer(): ReactElement {
	const {periods} = useBootstrap();
	const {voteEnd} = periods || {};
	const time = useTimer({endTime: Number(voteEnd)});
	return <>{`in ${time}`}</>;
}

function ClaimHeading(): ReactElement {
	const {periods: {voteStatus}} = useBootstrap();
	if (voteStatus === 'ended') {
		return (
			<div className={'mb-10 flex w-[52%] flex-col justify-center'}>
				<h1 className={'text-3xl font-black md:text-8xl'}>
					{'Claim'}
				</h1>
				<p className={'pt-8 text-neutral-700'}>{'You did your democratic duty beautifully anon.'}</p>
				<p className={'text-neutral-700'}>{'And now it’s time to claim your ‘good on chain citizen’ rewards. Enjoy!'}</p>
			</div>
		);
	}

	return (
		<div className={'mb-10 flex w-3/4 flex-col justify-center'}>
			<h1 className={'text-3xl font-black md:text-8xl'}>
				{'Claim'}
				<span suppressHydrationWarning className={'text-xs font-normal italic text-neutral-400'}>
					{'Soon ™️'}
				</span>
			</h1>
			<b
				suppressHydrationWarning
				className={'font-number mt-4 text-4xl text-purple-300'}>
				<Timer />
			</b>
			<p className={'pt-8 text-neutral-700'}>{'If you voted for any LSTs you’d like to see included in yETH, you’re eligble to recieve incentives from the top 5 protocols (even if you didn’t vote for them).'}</p>
			<p className={'text-neutral-700'}>{' But hold your horses anon, you can claim soon.'}</p>
		</div>
	);
}

function Claim(): ReactElement {
	const {address} = useWeb3();
	const {
		periods: {voteStatus},
		whitelistedLST: {whitelistedLST},
		voting: {voteData, onUpdate: refreshVoteData},
		incentives: {groupIncentiveHistory, claimedIncentives, refreshClaimedIncentives}
	} = useBootstrap();
	const [claimableIncentive, set_claimableIncentive] = useState<TClaimDetails[]>([]);
	const [totalIncentiveValue, set_totalIncentiveValue] = useState<number>(0);
	const [isModalOpen, set_isModalOpen] = useState<boolean>(false);
	const [className, set_className] = useState('pointer-events-none opacity-40');

	useEffect((): void => {
		if (voteStatus !== 'ended') {
			set_className('pointer-events-none opacity-40');
		} else {
			set_className('');
		}
	}, [voteStatus, className]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Compute the totalVotes you did for all the whitelistedLSTs you voted for.
	** It will be 0 if you didn't vote for any whitelistedLSTs.
	**
	** @deps: whitelistedLST - The list of whitelistedLSTs.
	** @returns: {raw: bigint, normalized: number} - The total number of votes you did.
	**********************************************************************************************/
	const totalVotes = useMemo((): TNormalizedBN => {
		let sum = 0n;
		for (const item of Object.values(whitelistedLST)) {
			sum += item.extra.votes || 0n;
		}
		return toNormalizedBN(sum);
	}, [whitelistedLST]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Once the data are loaded, we need to compute the total incentives you can claim. The
	** incentives are rewards you got for voting to the yEth composition. The rewards are the ones
	** in the top 5 protocols (winners), even if you didn't vote for them.
	** It will not run of you didn't vote for any whitelistedLSTs.
	**
	** @deps: winners - The top 5 protocols that won the vote.
	** @deps: protocols - The list of all protocols, including the winners, with the incentives.
	** @deps: votesUsedPerProtocol - The number of votes you did for each protocol.
	** @deps: totalVotes - The total number of votes casted for all the lst.
	** @deps: votesUsed - The total number of votes you casted for the winners.
	** @deps: claimedIncentives - The list of all the incentives you already claimed.
	** @deps: address - The connected wallet address.
	**********************************************************************************************/
	useEffect((): void => {
		if (totalVotes.raw === 0n || !claimedIncentives) {
			return;
		}
		let _totalIncentiveValue = 0;
		const claimData: TClaimDetails[] = [];

		/* 🔵 - Yearn Finance **********************************************************************
		** As only the winner are giving incentives, we need to loop through the winners only.
		** As all winners are giving incentives, none should be skipped.
		******************************************************************************************/
		for (const protocol of voteData.winners) {
			const incentivesForThisProtocol = groupIncentiveHistory.protocols[protocol];
			if (!incentivesForThisProtocol) {
				continue;
			}
			for (const incentive of incentivesForThisProtocol.incentives) {
				/* 🔵 - Yearn Finance **************************************************************
				** We compute:
				** - the value of the incentive you can claim. The value is the total usd amount
				**   you should get when claiming this specific incentive.
				** - the amount of the incentive you can claim. The amount is the total amount of
				**   tokens you should get when claiming this specific incentive.
				** - the id of the incentive you can claim. The id is the unique identifier of the
				**   incentive you can claim.
				**********************************************************************************/
				const valueOfThis = (
					incentive.value
					* Number(voteData.votesUsed.normalized || 0)
					/ Number(totalVotes.normalized)
				);
				const amountOfThis = toNormalizedBN(
					(incentive.amount * voteData.votesUsed.raw / totalVotes.raw),
					incentive?.incentiveToken?.decimals || 18
				);
				const id = `${protocol}-${incentive.incentive}-${toAddress(address)}`;

				/* 🔵 - Yearn Finance **************************************************************
				** If we already have this incentive in the list, we skip it.
				** If we already claimed this incentive, we skip it.
				**********************************************************************************/
				if (claimData.find((item): boolean => item.id === id)) {
					continue;
				}
				if (claimedIncentives.find((item): boolean => item.id === id)) {
					_totalIncentiveValue += valueOfThis;
					continue;
				}

				/* 🔵 - Yearn Finance **************************************************************
				** Add the incentive to the list of claimable incentives.
				**********************************************************************************/
				claimData.push({
					id: id,
					protocolName: incentive.protocolName,
					value: valueOfThis,
					amount: amountOfThis,
					token: incentive.incentiveToken as TTokenInfo,
					isSelected: true,
					multicall: {
						target: toAddress(process.env.BOOTSTRAP_ADDRESS),
						callData: encodeFunctionData({
							abi: BOOTSTRAP_ABI,
							functionName: 'claim_incentive',
							args: [toAddress(protocol), toAddress(incentive.incentive), toAddress(address)]
						})
					}
				});
				_totalIncentiveValue += valueOfThis;
			}
		}

		/* 🔵 - Yearn Finance **********************************************************************
		** Perform a batched update to avoid multiple re-renders, updating both the list of
		** claimable incentives and the total value of the incentives you can claim.
		******************************************************************************************/
		performBatchedUpdates((): void => {
			set_claimableIncentive(claimData);
			set_totalIncentiveValue(_totalIncentiveValue);
		});
	}, [voteData.winners, groupIncentiveHistory.protocols, voteData.votesUsedPerProtocol, totalVotes, voteData.votesUsed.normalized, voteData.votesUsed.raw, claimedIncentives, address]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Compute the total amount of incentives you already claimed.
	**
	** @deps: claimableIncentive - The list of all the incentives you can claim.
	** @returns: number - The total amount of incentives you can claim.
	**********************************************************************************************/
	const totalToClaim = useMemo((): number => (
		claimableIncentive.reduce((total, incentive): number => total + incentive.value, 0)
	), [claimableIncentive]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Function triggered when the user clicks a checkbox in the confirmation modal. This will mark
	** the incentive as selected or not.
	**
	** @params: id - The id of the incentive.
	** @params: isSelected - Whether the incentive should be selected or not.
	** @deps: claimableIncentive - The list of all the incentives you can claim.
	**********************************************************************************************/
	const onUpdateIncentive = useCallback((id: string, isSelected: boolean): void => {
		const newClaimableIncentive = [...claimableIncentive];
		const index = newClaimableIncentive.findIndex((item): boolean => item.id === id);
		if (index === -1) {
			return;
		}
		newClaimableIncentive[index].isSelected = isSelected;
		set_claimableIncentive(newClaimableIncentive);
	}, [claimableIncentive]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Function triggered when the user has successfully claimed an incentive. This will close the
	** modal and refresh the list of claimed incentives and the vote data.
	**
	** @deps: refreshClaimedIncentives - The function to refresh the list of claimed incentives.
	** @deps: refreshVoteData - The function to refresh the vote data.
	**********************************************************************************************/
	const onClaimedSuccess = useCallback(async (): Promise<void> => {
		set_isModalOpen(false);
		await Promise.all([
			refreshClaimedIncentives(),
			refreshVoteData()
		]);
	}, [refreshClaimedIncentives, refreshVoteData]);

	return (
		<section className={'grid grid-cols-1 pt-10 md:mb-20 md:pt-12'}>
			<div className={'mb-20 md:mb-0'}>
				<ClaimHeading />
				<div
					key={voteStatus}
					className={cl('flex flex-col md:w-1/2 lg:w-[352px]', className)}>
					<div className={'mb-4 w-full bg-neutral-100 p-4'}>
						<p className={'pb-2'}>{'Unclaimed incentives, $'}</p>
						<b suppressHydrationWarning className={'font-number text-3xl'}>
							{`$${formatAmount(totalToClaim, 2, 2)}/$${formatAmount(totalIncentiveValue, 2, 2)}`}
						</b>
					</div>
					<Button
						onClick={(): void => set_isModalOpen(true)}
						isDisabled={claimableIncentive.length === 0}
						className={'yearn--button w-full rounded-md !text-sm'}>
						{'Claim all'}
					</Button>
				</div>
			</div>
			<Modal
				className={'small-modal'}
				isOpen={isModalOpen}
				onClose={(): void => set_isModalOpen(false)}>
				<ClaimConfirmationModal
					onUpdateIncentive={onUpdateIncentive}
					claimableIncentive={claimableIncentive}
					onSuccess={onClaimedSuccess}
					onCancel={(): void => set_isModalOpen(false)} />
			</Modal>
		</section>
	);
}

export default Claim;
