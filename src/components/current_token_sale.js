import { useEffect, useState } from 'react';
import { nativeTokenFromPair, saleAssetFromPair } from '../helpers/asset_pairs';
import CW20TokenName from './cw20_token_name';
import InfoCard from './info_card';
import { getWeights, getPool } from '../terra/queries';
import fetchUSTExchangeRate from '../services/fetch_ust_exchange_rate';
import { formatUSD, formatNumber } from '../helpers/number_formatters';
import { calcPrice } from '../terra/math';
import { useRefreshingEffect } from '../helpers/effects';

const REFRESH_INTERVAL = 30_000; // 30s

function CurrentTokenSale({ pair }) {
  const [nativeTokenWeight, setNativeTokenWeight] = useState();
  const [saleTokenWeight, setSaleTokenWeight] = useState();
  const [pool, setPool] = useState();
  const [ustPrice, setUSTPrice] = useState();
  const [usdPrice, setUSDPrice] = useState();
  const [ustExchangeRate, setUSTExchangeRate] = useState();

  useRefreshingEffect(async () => {
    const [[nativeTokenWeight, saleTokenWeight], pool] = await Promise.all([
      getWeights(
        pair.contract_addr,
        nativeTokenFromPair(pair.asset_infos).info.native_token.denom
      ),
      getPool(pair.contract_addr)
    ]);

    setNativeTokenWeight(nativeTokenWeight);
    setSaleTokenWeight(saleTokenWeight);
    setPool(pool);
  }, REFRESH_INTERVAL, [pair]);

  useRefreshingEffect(async() => {
    const exchangeRate = await fetchUSTExchangeRate();

    setUSTExchangeRate(exchangeRate);
  }, REFRESH_INTERVAL);

  useEffect(() => {
    if(pool?.assets == null || nativeTokenWeight === undefined || saleTokenWeight === undefined){
      setUSTPrice(null);
      return;
    }

    setUSTPrice(calcPrice({
      ustPoolSize: nativeTokenFromPair(pool.assets).amount,
      tokenPoolSize: saleAssetFromPair(pool.assets).amount,
      ustWeight: nativeTokenWeight,
      tokenWeight: saleTokenWeight
    }));
  }, [pool, nativeTokenWeight, saleTokenWeight]);

  useEffect(() => {
    // Don't convert if ust price or exchange rate is null
    if(ustPrice == null || ustExchangeRate == null) {
      setUSDPrice(null);
      return;
    }

    setUSDPrice(ustPrice * ustExchangeRate);
  }, [ustExchangeRate, ustPrice]);

  // TODO: Fetch time remaining

  return (
    <>
      <h1 className="text-lg">
        <CW20TokenName address={saleAssetFromPair(pair.asset_infos).info.token.contract_addr} /> Token Sale
      </h1>

      <div className="grid grid-cols-4 gap-6 my-6">
        <InfoCard label="Price" value={formatUSD(usdPrice)} loading={usdPrice == null} />
        <InfoCard label="Coins Remaining" value={pool && formatNumber(saleAssetFromPair(pool.assets).amount)} loading={pool == null} />
        <InfoCard label="Time Remaining" value="1d : 22h : 25m" />
        <InfoCard label="Current Weight" value={`${Math.round(nativeTokenWeight)} : ${Math.round(saleTokenWeight)}`} loading={nativeTokenWeight === undefined} />
      </div>
    </>
  );
}

export default CurrentTokenSale;