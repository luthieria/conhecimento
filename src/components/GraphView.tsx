import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface GraphViewProps {
  onNodeClick: (path: string) => void;
}

export default function GraphView({ onNodeClick }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Clear previous
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = window.innerHeight;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height]);

    let simulation: any = null;

    fetch('/assets/indices/linkIndex.json')
      .then(res => res.json())
      .then(data => {
        const linksData = data.index?.links || {};
        const backlinksData = data.index?.backlinks || {};
        
        // Extract unique nodes
        const nodesSet = new Set<string>();
        const links: { source: string, target: string }[] = [];

        Object.keys(linksData).forEach(source => {
          nodesSet.add(source);
          linksData[source].forEach((link: any) => {
            nodesSet.add(link.target);
            links.push({ source: link.source, target: link.target });
          });
        });

        Object.keys(backlinksData).forEach(target => {
          nodesSet.add(target);
          backlinksData[target].forEach((link: any) => {
            nodesSet.add(link.source);
            // Don't duplicate links
            if (!links.some(l => l.source === link.source && l.target === link.target)) {
              links.push({ source: link.source, target: link.target });
            }
          });
        });

        const nodes = Array.from(nodesSet).map(id => ({ id }));

        simulation = d3.forceSimulation(nodes as any)
          .force('charge', d3.forceManyBody().strength(-150))
          .force('link', d3.forceLink(links).id((d: any) => d.id).distance(60))
          .force('center', d3.forceCenter());

        const linkGroup = svg.append('g')
          .selectAll('line')
          .data(links)
          .join('line')
          .attr('stroke', '#4c566a')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.6);

        const nodeGroup = svg.append('g')
          .selectAll('circle')
          .data(nodes)
          .join('circle')
          .attr('r', 5)
          .attr('fill', '#8fbcbb')
          .style('cursor', 'pointer')
          .call(d3.drag<SVGCircleElement, any>()
            .on('start', (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }) as any)
          .on('click', (_, d) => {
            // Trim leading slash and append .md to match the file tree format
            let path = d.id;
            if (path.startsWith('/')) path = path.slice(1);
            
            // Decode URL encoding and replace dashes with spaces
            // since Hugo linkIndex uses URL-safe paths with dashes
            const decodedPath = decodeURIComponent(path).replace(/-/g, ' ');
            onNodeClick(decodedPath + '.md');
          })
          .on('mouseover', function() {
            d3.select(this).attr('fill', '#a3be8c').attr('r', 8);
          })
          .on('mouseout', function() {
            d3.select(this).attr('fill', '#8fbcbb').attr('r', 5);
          });

        const labels = svg.append('g')
          .selectAll('text')
          .data(nodes)
          .join('text')
          .text((d: any) => {
            try {
              const name = d.id.split('/').pop() || d.id;
              return decodeURIComponent(name).replace(/-/g, ' ');
            } catch {
              return d.id.split('/').pop() || d.id;
            }
          })
          .attr('font-size', '10px')
          .attr('fill', '#e7e5e8')
          .attr('opacity', 0.7)
          .attr('dx', 8)
          .attr('dy', 3)
          .style('pointer-events', 'none')
          .style('font-family', 'IBM Plex Sans, sans-serif');

        simulation.on('tick', () => {
          linkGroup
            .attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x)
            .attr('y2', (d: any) => d.target.y);

          nodeGroup
            .attr('cx', (d: any) => d.x)
            .attr('cy', (d: any) => d.y);

          labels
            .attr('x', (d: any) => d.x)
            .attr('y', (d: any) => d.y);
        });

        // Add zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.1, 4])
          .on('zoom', (event) => {
            svg.selectAll('g').attr('transform', event.transform);
          });
        
        svg.call(zoom);
      })
      .catch(console.error);

    return () => {
      if (simulation) simulation.stop();
    };
  }, [onNodeClick]);

  return <div ref={containerRef} className="w-full h-full absolute inset-0 z-0 bg-background" />;
}
