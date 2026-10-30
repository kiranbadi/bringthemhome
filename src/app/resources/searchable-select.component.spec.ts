import { TestBed } from '@angular/core/testing';
import { SearchableSelectComponent } from './searchable-select.component';

describe('Searchable resource filters', () => {
  it('filters names without changing the submitted ID until selection', () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('label', 'State');
    fixture.componentRef.setInput('options', [
      { id: '36', name: 'New York' },
      { id: '06', name: 'California' },
    ]);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const change = vi.fn();
    component.registerOnChange(change);
    component.query.set('york');
    expect(component.filtered()).toEqual([{ id: '36', name: 'New York' }]);
    expect(change).not.toHaveBeenCalled();
    component.select('36');
    expect(change).toHaveBeenCalledWith('36');
    expect(component.display('36')).toBe('New York');
    component.text.setValue(null);
    expect(change).toHaveBeenLastCalledWith('');
  });
  it('displays a restored ID after its options arrive and supports disabled controls', async () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('label', 'State');
    fixture.componentInstance.writeValue('36');
    fixture.detectChanges();
    fixture.componentRef.setInput('options', [{ id: '36', name: 'New York' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').value).toBe('New York');
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);
  });
});
