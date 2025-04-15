import { Button, Card, Select } from '@swig/ui';
import {
  permissionOptions,
  lendingTokenOptions,
  dcaTokenOptions,
  tradingTokenOptions,
} from '../data';
import { displayLabels, formatOptions } from '../utils/formatOptions';
import { UserDashboardProps } from '../types/ui';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa6';
import { useState } from 'react';

const UserDashboard: React.FC<UserDashboardProps> = ({
  requestPermission,
  loading,
  selectedLendingPermission,
  selectedDcaPermission,
  selectedTradingPermission,
  lendingSolRequired,
  dcaSolRequired,
  tradingSolRequired,
  lendingTokens,
  dcaTokens,
  tradingTokens,
  userLendingTokens,
  setUserLendingTokens,
  userDcaTokens,
  setUserDcaTokens,
  userTradingTokens,
  setUserTradingTokens,
  userLendingTokenAmounts,
  handleLendingAmountChange,
  userDcaTokenAmounts,
  handleDcaAmountChange,
  userTradingTokenAmounts,
  handleTradingAmountChange,
}) => {
  const [showLendingPermissions, setShowLendingPermissions] = useState(false);
  const [showDcaPermissions, setShowDcaPermissions] = useState(false);
  const [showTradingPermissions, setShowTradingPermissions] = useState(false);

  const lendingPermissions = displayLabels(
    permissionOptions,
    selectedLendingPermission
  );
  const dcaPermissions = displayLabels(
    permissionOptions,
    selectedDcaPermission
  );
  const tradingPermissions = displayLabels(
    permissionOptions,
    selectedTradingPermission
  );

  const lendingTokensOptions = formatOptions(
    lendingTokenOptions,
    lendingTokens
  );
  const dcaTokensOptions = formatOptions(dcaTokenOptions, dcaTokens);
  const tradingTokensOptions = formatOptions(
    tradingTokenOptions,
    tradingTokens
  );

  return (
    <div className='mt-6 flex flex-row gap-2 items-start'>
      <Card>
        <div>Lending protocol</div>
        <div>Description of the protocol with a cool graphic</div>
        {lendingSolRequired === 0 ? null : (
          <div className='text-sm text-gray-500'>
            <span>SOL Required for transactions fees: </span>
            <span className='text-sm text-gray-800'>{lendingSolRequired}</span>
          </div>
        )}
        {lendingTokensOptions.length > 0 ? (
          <div className='flex flex-col gap-1'>
            <span className='text-sm text-gray-500'>
              Select the tokens you would like to lend:
            </span>
            <Select
              multiple
              value={userLendingTokens}
              onChange={(value) => setUserLendingTokens(value as string[])}
              options={lendingTokensOptions}
            />
          </div>
        ) : null}
        <div className='flex flex-col gap-1'>
          {userLendingTokens.map((token) => (
            <div key={token}>
              <span className='text-sm text-gray-500'>{token}</span>
              <input
                type='number'
                className='w-full border border-gray-300 rounded-md p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                value={
                  userLendingTokenAmounts.find((item) => item.token === token)
                    ?.amount || ''
                }
                onChange={(e) =>
                  handleLendingAmountChange(token, e.target.value)
                }
                placeholder={`Enter amount for ${token}`}
              />
            </div>
          ))}
        </div>

        {lendingPermissions.length > 0 ? (
          <span
            onClick={() => setShowLendingPermissions(!showLendingPermissions)}
            className='text-sm text-gray-500 flex flex-row gap-2 items-center'
          >
            <span>permissions</span>
            {!showLendingPermissions ? (
              <FaChevronDown size={12} />
            ) : (
              <FaChevronUp size={12} />
            )}
          </span>
        ) : null}

        {showLendingPermissions && (
          <div className='flex flex-col gap-2'>
            <span className='text-sm text-gray-500'>
              We will need the following permissions from your swig wallet to
              help you interact with the lending protocol:
            </span>
            <div className='text-sm text-gray-800'>
              {lendingPermissions.map((permission) => (
                <div key={permission}>{permission}</div>
              ))}
            </div>
          </div>
        )}
        <Button
          variant='primary'
          onClick={() =>
            requestPermission(
              selectedLendingPermission,
              lendingSolRequired,
              userLendingTokenAmounts
            )
          }
          disabled={loading}
        >
          Connect to Swig Wallet
        </Button>
      </Card>

      {/* Subscription */}
      <Card>
        <div>Subscription protocol</div>
        <div>Description of the protocol with a cool graphic</div>
        {dcaSolRequired === 0 ? null : (
          <div className='text-sm text-gray-500'>
            <span>SOL Required for transactions fees: </span>
            <span className='text-sm text-gray-800'>{dcaSolRequired}</span>
          </div>
        )}

        {dcaTokensOptions.length > 0 ? (
          <div className='flex flex-col gap-1'>
            <span className='text-sm text-gray-500'>
              Select the tokens you would like to allow for monthly
              subscriptions:
            </span>
            <Select
              multiple
              value={userDcaTokens}
              onChange={(value) => setUserDcaTokens(value as string[])}
              options={dcaTokensOptions}
            />
          </div>
        ) : null}
        <div className='flex flex-col gap-1'>
          {userDcaTokens.map((token) => (
            <div key={token}>
              <span className='text-sm text-gray-500'>{token}</span>
              <input
                type='number'
                className='w-full border border-gray-300 rounded-md p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                value={
                  userDcaTokenAmounts.find((item) => item.token === token)
                    ?.amount || ''
                }
                onChange={(e) => handleDcaAmountChange(token, e.target.value)}
                placeholder={`Enter amount for ${token}`}
              />
            </div>
          ))}
        </div>
        {dcaPermissions.length > 0 ? (
          <span
            onClick={() => setShowDcaPermissions(!showDcaPermissions)}
            className='text-sm text-gray-500 flex flex-row gap-2 items-center'
          >
            <span>permissions</span>
            {!showDcaPermissions ? (
              <FaChevronDown size={12} />
            ) : (
              <FaChevronUp size={12} />
            )}
          </span>
        ) : null}

        {showDcaPermissions && (
          <div className='flex flex-col gap-2'>
            <span className='text-sm text-gray-500'>
              We will need the following permissions from your swig wallet to
              help you interact with the Subscription protocol:
            </span>
            <div className='text-sm text-gray-800'>
              {dcaPermissions.map((permission) => (
                <div key={permission}>{permission}</div>
              ))}
            </div>
          </div>
        )}
        <Button
          variant='primary'
          onClick={() =>
            requestPermission(
              selectedDcaPermission,
              dcaSolRequired,
              userDcaTokenAmounts
            )
          }
          disabled={loading}
        >
          Connect to Swig Wallet
        </Button>
      </Card>

      {/* Trading */}
      <Card>
        <div>Trading protocol</div>
        <div>Description of the protocol with a cool graphic</div>
        {tradingSolRequired === 0 ? null : (
          <div className='text-sm text-gray-500'>
            <span>SOL Required for transactions fees: </span>
            <span className='text-sm text-gray-800'>{tradingSolRequired}</span>
          </div>
        )}

        {tradingTokensOptions.length > 0 ? (
          <div className='flex flex-col gap-1'>
            <span className='text-sm text-gray-500'>
              Select the tokens you would like to trade:
            </span>
            <Select
              multiple
              value={userTradingTokens}
              onChange={(value) => setUserTradingTokens(value as string[])}
              options={tradingTokensOptions}
            />
          </div>
        ) : null}
        <div className='flex flex-col gap-1'>
          {userTradingTokens.map((token) => (
            <div key={token}>
              <span className='text-sm text-gray-500'>{token}</span>
              <input
                type='number'
                className='w-full border border-gray-300 rounded-md p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                value={
                  userTradingTokenAmounts.find((item) => item.token === token)
                    ?.amount || ''
                }
                onChange={(e) =>
                  handleTradingAmountChange(token, e.target.value)
                }
                placeholder={`Enter amount for ${token}`}
              />
            </div>
          ))}
        </div>
        {tradingPermissions.length > 0 ? (
          <span
            onClick={() => setShowTradingPermissions(!showTradingPermissions)}
            className='text-sm text-gray-500 flex flex-row gap-2 items-center'
          >
            <span>permissions</span>
            {!showTradingPermissions ? (
              <FaChevronDown size={12} />
            ) : (
              <FaChevronUp size={12} />
            )}
          </span>
        ) : null}

        {showTradingPermissions && (
          <div className='flex flex-col gap-2'>
            <span className='text-sm text-gray-500'>
              We will need the following permissions from your swig wallet to
              help you interact with the trading protocol:
            </span>
            <div className='text-sm text-gray-800'>
              {tradingPermissions.map((permission) => (
                <div key={permission}>{permission}</div>
              ))}
            </div>
          </div>
        )}
        <Button
          variant='primary'
          onClick={() =>
            requestPermission(
              selectedTradingPermission,
              tradingSolRequired,
              userTradingTokenAmounts
            )
          }
          disabled={loading}
        >
          Connect to Swig Wallet
        </Button>
      </Card>
    </div>
  );
};

export default UserDashboard;
