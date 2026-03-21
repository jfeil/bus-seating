import { Component, Input, OnChanges, ElementRef, ViewChild, AfterViewInit, SimpleChanges } from '@angular/core';
import * as d3 from 'd3';
import { Group, Bus, SeatingPlanEntry, RidePreference, PERSON_TYPE_CONFIG } from '../core/models';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  size: number;
  isInstructor: boolean;
  busName?: string;
  color?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  met: boolean;
}

const BUS_COLORS = ['#42a5f5', '#66bb6a', '#ffa726', '#ef5350', '#ab47bc', '#26c6da'];

@Component({
  selector: 'app-seating-graph',
  standalone: true,
  template: `<div #graphContainer class="graph-container"></div>`,
  styles: [`
    .graph-container {
      width: 100%;
      height: 500px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #fafafa;
      overflow: hidden;
    }
  `],
})
export class SeatingGraphComponent implements AfterViewInit, OnChanges {
  @ViewChild('graphContainer') container!: ElementRef<HTMLDivElement>;
  @Input() groups: Group[] = [];
  @Input() buses: Bus[] = [];
  @Input() seatingPlan: SeatingPlanEntry[] = [];
  @Input() preferences: RidePreference[] = [];

  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private initialized = false;

  ngAfterViewInit() {
    this.initialized = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.initialized) {
      this.render();
    }
  }

  private render() {
    const el = this.container.nativeElement;
    const width = el.clientWidth || 800;
    const height = el.clientHeight || 500;

    d3.select(el).selectAll('*').remove();
    this.svg = d3.select(el).append('svg').attr('width', width).attr('height', height);

    const nodes = this.buildNodes();
    const links = this.buildLinks(nodes);

    if (nodes.length === 0) {
      this.svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#999')
        .text('No data to display. Add groups and run the solver.');
      return;
    }

    const busNames = [...new Set(this.seatingPlan.map(b => b.bus_name))];
    const colorScale = (name: string) => BUS_COLORS[busNames.indexOf(name) % BUS_COLORS.length];

    // Assign colors based on bus assignment
    const assignedGroups = this.buildAssignmentMap();
    nodes.forEach(n => {
      const busName = assignedGroups.get(n.id);
      if (busName) {
        n.busName = busName;
        n.color = colorScale(busName);
      } else {
        n.color = '#bdbdbd';
      }
    });

    // Legend
    const legend = this.svg.append('g').attr('transform', 'translate(10, 10)');
    busNames.forEach((name, i) => {
      const g = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
      g.append('rect').attr('width', 16).attr('height', 16).attr('rx', 3).attr('fill', colorScale(name));
      g.append('text').attr('x', 22).attr('y', 13).attr('font-size', '12px').attr('fill', '#333').text(name);
    });

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.size * 4 + 5));

    // Cluster force: push nodes toward their bus cluster position
    if (busNames.length > 0) {
      const clusterCenters = new Map<string, { x: number; y: number }>();
      busNames.forEach((name, i) => {
        const angle = (2 * Math.PI * i) / busNames.length - Math.PI / 2;
        const radius = Math.min(width, height) * 0.25;
        clusterCenters.set(name, {
          x: width / 2 + radius * Math.cos(angle),
          y: height / 2 + radius * Math.sin(angle),
        });
      });

      simulation.force('cluster', d3.forceX<GraphNode>(d => {
        const center = d.busName ? clusterCenters.get(d.busName) : undefined;
        return center ? center.x : width / 2;
      }).strength(0.3));

      simulation.force('clusterY', d3.forceY<GraphNode>(d => {
        const center = d.busName ? clusterCenters.get(d.busName) : undefined;
        return center ? center.y : height / 2;
      }).strength(0.3));
    }

    // Draw links
    const link = this.svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.met ? '#4caf50' : '#f44336')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', d => d.met ? '' : '4,4')
      .attr('opacity', 0.6);

    // Draw nodes
    const node = this.svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    node.append('circle')
      .attr('r', d => d.size * 4 + 6)
      .attr('fill', d => d.color!)
      .attr('stroke', d => d.isInstructor ? '#1565c0' : '#fff')
      .attr('stroke-width', d => d.isInstructor ? 3 : 1.5);

    node.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.size * 4 + 18)
      .attr('font-size', '11px')
      .attr('fill', '#333');

    // Size label inside node
    node.append('text')
      .text(d => d.size.toString())
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  private buildNodes(): GraphNode[] {
    return this.groups.map(g => ({
      id: g.id,
      label: g.name,
      size: g.members.length,
      isInstructor: g.members.some(m => PERSON_TYPE_CONFIG[m.person_type].isInstructorLike),
    }));
  }

  private buildLinks(nodes: GraphNode[]): GraphLink[] {
    const nodeIds = new Set(nodes.map(n => n.id));
    const assignmentMap = this.buildAssignmentMap();

    return this.preferences
      .filter(p => nodeIds.has(p.group_a_id) && nodeIds.has(p.group_b_id))
      .map(p => ({
        source: p.group_a_id,
        target: p.group_b_id,
        met: assignmentMap.get(p.group_a_id) === assignmentMap.get(p.group_b_id)
              && assignmentMap.has(p.group_a_id),
      }));
  }

  private buildAssignmentMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const bus of this.seatingPlan) {
      for (const group of bus.groups) {
        map.set(group.group_id, bus.bus_name);
      }
    }
    return map;
  }
}
