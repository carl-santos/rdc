import { CdrSource } from '../../utils/cdrKnowledge';

interface CdrSourcesProps {
    sources: CdrSource[];
}

const CdrSources = ({ sources }: CdrSourcesProps) => {
    if (sources.length === 0) return null;

    return (
        <details className="mt-3 text-left">
            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-primary">
                Fontes ({sources.length})
            </summary>
            <ol className="mt-2 space-y-2">
                {sources.map((source) => (
                    <li key={`${source.index}-${source.file_name}`} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                            [{source.index}] {source.file_name}
                        </span>
                        {source.excerpt && (
                            <p className="mt-0.5 text-slate-500 dark:text-slate-400">{source.excerpt}</p>
                        )}
                    </li>
                ))}
            </ol>
        </details>
    );
};

export default CdrSources;
