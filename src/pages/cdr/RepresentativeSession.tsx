import { useOutletContext } from 'react-router-dom';
import ChatPanel from '../../components/cdr/ChatPanel';
import { CdrSessionMode, DigitalRepresentative } from '../../types/cdr';

interface OutletCtx {
    representative: DigitalRepresentative;
}

const RepresentativeSession = ({ mode }: { mode: CdrSessionMode }) => {
    const { representative } = useOutletContext<OutletCtx>();
    return <ChatPanel representative={representative} mode={mode} />;
};

export default RepresentativeSession;
