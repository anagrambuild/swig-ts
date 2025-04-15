import { Select, Card } from '@swig/ui';
import {
  permissionOptions,
  lendingTokenOptions,
  dcaTokenOptions,
  tradingTokenOptions,
} from '../data';
import { AdminDashboardProps } from '../types/ui';

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  selectedLendingPermission,
  setSelectedLendingPermission,
  selectedDcaPermission,
  setSelectedDcaPermission,
  selectedTradingPermission,
  setSelectedTradingPermission,
  lendingSolRequired,
  setLendingSolRequired,
  dcaSolRequired,
  setDcaSolRequired,
  tradingSolRequired,
  setTradingSolRequired,
  lendingTokens,
  setLendingTokens,
  dcaTokens,
  setDcaTokens,
  tradingTokens,
  setTradingTokens,
}) => {
  return (
    <div>
      <div className='text-lg font-medium text-gray-900'>
        Configure permissions for each protocol according to swig specs
      </div>
      <div className='flex flex-row gap-4 items-start'>
        <Card>
          <div>Lending protocol</div>
          <div>
            <span className='text-sm text-gray-500'>
              Select permissions for lending protocol
            </span>
            <Select
              multiple
              value={selectedLendingPermission}
              onChange={(value) =>
                setSelectedLendingPermission(value as string[])
              }
              options={permissionOptions}
              placeholder='Select options'
            />
          </div>
          <div>
            <span className='text-sm text-gray-500'>
              Amount of SOL required for transaction fees
            </span>
            <input
              type='number'
              className='w-full border border-gray-300 rounded-md p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
              value={lendingSolRequired}
              onChange={(e) => setLendingSolRequired(Number(e.target.value))}
            />
          </div>

          <div>
            <span className='text-sm text-gray-500'>
              Select possible tokens for lending protocol
            </span>
            <Select
              multiple
              value={lendingTokens}
              onChange={(value) => setLendingTokens(value as string[])}
              options={lendingTokenOptions}
            />
          </div>
        </Card>

        <Card>
          <div>Subscription protocol</div>
          <div>
            <span className='text-sm text-gray-500'>
              Select permissions for Subscription protocol
            </span>
            <Select
              multiple
              value={selectedDcaPermission}
              onChange={(value) => setSelectedDcaPermission(value as string[])}
              options={permissionOptions}
              placeholder='Select options'
            />
          </div>
          <div>
            <span className='text-sm text-gray-500'>
              Amount of SOL required for transaction fees
            </span>
            <input
              type='number'
              className='w-full border border-gray-300 rounded-md p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
              value={dcaSolRequired}
              onChange={(e) => setDcaSolRequired(Number(e.target.value))}
            />
          </div>
          <div>
            <span className='text-sm text-gray-500'>
              Select possible tokens for monthly subscriptions
            </span>
            <Select
              multiple
              value={dcaTokens}
              onChange={(value) => setDcaTokens(value as string[])}
              options={dcaTokenOptions}
            />
          </div>
        </Card>

        <Card>
          <div>Trading protocol</div>
          <div>
            <span className='text-sm text-gray-500'>
              Select permissions for trading protocol
            </span>
            <Select
              multiple
              value={selectedTradingPermission}
              onChange={(value) =>
                setSelectedTradingPermission(value as string[])
              }
              options={permissionOptions}
              placeholder='Select options'
            />
          </div>
          <div>
            <span className='text-sm text-gray-500'>
              Amount of SOL required for transaction fees
            </span>
            <input
              type='number'
              className='w-full border border-gray-300 rounded-md p-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
              value={tradingSolRequired}
              onChange={(e) => setTradingSolRequired(Number(e.target.value))}
            />
          </div>
          <div>
            <span className='text-sm text-gray-500'>
              Select possible tokens for trading protocol
            </span>
            <Select
              multiple
              value={tradingTokens}
              onChange={(value) => setTradingTokens(value as string[])}
              options={tradingTokenOptions}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
